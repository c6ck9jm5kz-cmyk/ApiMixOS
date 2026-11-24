package controller

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	maxModelDocBytes  = 64 * 1024
	maxModelDocNotes  = 50
	maxModelDocParams = 100
)

type modelDocParam struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Description string `json:"description"`
}

// modelDocContent is the administrator-authored part of a model's API doc.
// Mode "auto" keeps the generated doc and adds these supplements; mode
// "custom" replaces the generated body with Markdown.
type modelDocContent struct {
	Mode            string          `json:"mode"`
	Summary         string          `json:"summary"`
	Notes           []string        `json:"notes"`
	Params          []modelDocParam `json:"params"`
	RequestExample  string          `json:"request_example"`
	ResponseExample string          `json:"response_example"`
	Markdown        string          `json:"markdown"`
}

type modelDocResponse struct {
	ModelName   string           `json:"model_name"`
	Content     *modelDocContent `json:"content"`
	UpdatedTime int64            `json:"updated_time"`
}

func normalizeModelDocContent(content modelDocContent) (modelDocContent, error) {
	content.Mode = strings.TrimSpace(content.Mode)
	if content.Mode == "" {
		content.Mode = "auto"
	}
	if content.Mode != "auto" && content.Mode != "custom" {
		return content, fmt.Errorf("mode must be auto or custom")
	}
	content.Summary = strings.TrimSpace(content.Summary)

	notes := make([]string, 0, len(content.Notes))
	for _, note := range content.Notes {
		if note = strings.TrimSpace(note); note != "" {
			notes = append(notes, note)
		}
	}
	if len(notes) > maxModelDocNotes {
		return content, fmt.Errorf("at most %d notes are allowed", maxModelDocNotes)
	}
	content.Notes = notes

	params := make([]modelDocParam, 0, len(content.Params))
	for _, param := range content.Params {
		param.Name = strings.TrimSpace(param.Name)
		param.Type = strings.TrimSpace(param.Type)
		param.Description = strings.TrimSpace(param.Description)
		if param.Name == "" {
			continue
		}
		if len(param.Name) > 64 {
			return content, fmt.Errorf("parameter name %q is too long", param.Name)
		}
		params = append(params, param)
	}
	if len(params) > maxModelDocParams {
		return content, fmt.Errorf("at most %d parameters are allowed", maxModelDocParams)
	}
	content.Params = params
	return content, nil
}

func decodeStoredModelDoc(doc *model.ModelDoc) *modelDocContent {
	if doc == nil || strings.TrimSpace(doc.Content) == "" {
		return nil
	}
	var content modelDocContent
	if err := common.UnmarshalJsonStr(doc.Content, &content); err != nil {
		common.SysError(fmt.Sprintf("invalid stored doc for model %s: %v", doc.ModelName, err))
		return nil
	}
	return &content
}

func isPublicPricingModel(modelName string) bool {
	for _, pricing := range model.GetPricing() {
		if pricing.ModelName == modelName {
			return true
		}
	}
	return false
}

func writeModelDoc(c *gin.Context, modelName string, doc *model.ModelDoc) {
	response := modelDocResponse{ModelName: modelName, Content: decodeStoredModelDoc(doc)}
	if doc != nil {
		response.UpdatedTime = doc.UpdatedTime
	}
	common.ApiSuccess(c, response)
}

// GetPublicModelDoc serves the supplements for a model listed on the public
// model plaza; unlisted or disabled models are reported as not found.
func GetPublicModelDoc(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" || !isPublicPricingModel(modelName) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "model not found"})
		return
	}
	doc, err := model.GetModelDoc(modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeModelDoc(c, modelName, doc)
}

func ListModelDocs(c *gin.Context) {
	summaries, err := model.ListModelDocSummaries()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summaries)
}

func GetModelDocAdmin(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	doc, err := model.GetModelDoc(modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	writeModelDoc(c, modelName, doc)
}

type saveModelDocRequest struct {
	ModelName string          `json:"model_name"`
	Content   modelDocContent `json:"content"`
}

func SaveModelDoc(c *gin.Context) {
	var req saveModelDocRequest
	if err := common.DecodeJson(http.MaxBytesReader(c.Writer, c.Request.Body, maxModelDocBytes+4096), &req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	req.ModelName = strings.TrimSpace(req.ModelName)
	if req.ModelName == "" || len(req.ModelName) > 128 {
		common.ApiErrorMsg(c, "model_name is required (max 128 characters)")
		return
	}
	content, err := normalizeModelDocContent(req.Content)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	encoded, err := common.Marshal(content)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(encoded) > maxModelDocBytes {
		common.ApiErrorMsg(c, fmt.Sprintf("doc is too large (max %d KB)", maxModelDocBytes/1024))
		return
	}
	doc, err := model.SaveModelDoc(req.ModelName, string(encoded))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "model_doc.save", map[string]interface{}{"model_name": req.ModelName})
	writeModelDoc(c, req.ModelName, doc)
}

func DeleteModelDoc(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.DeleteModelDoc(modelName); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, 0, "model_doc.delete", map[string]interface{}{"model_name": modelName})
	common.ApiSuccess(c, nil)
}

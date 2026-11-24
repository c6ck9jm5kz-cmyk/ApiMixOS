package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ModelDoc stores the administrator's hand-written additions to a model's
// public API documentation. The documentation itself is generated from the
// model's supported endpoint types; this row only holds the supplements or
// the full custom replacement, keyed by the public model name so it also
// works for models that have no metadata row.
type ModelDoc struct {
	Id          int    `json:"id"`
	ModelName   string `json:"model_name" gorm:"size:128;not null;uniqueIndex"`
	Content     string `json:"content" gorm:"type:text"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

type ModelDocSummary struct {
	ModelName   string `json:"model_name"`
	UpdatedTime int64  `json:"updated_time"`
}

// GetModelDoc returns nil without an error when the model has no saved doc.
func GetModelDoc(modelName string) (*ModelDoc, error) {
	var doc ModelDoc
	err := DB.Where("model_name = ?", modelName).First(&doc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

func ListModelDocSummaries() ([]ModelDocSummary, error) {
	summaries := make([]ModelDocSummary, 0)
	err := DB.Model(&ModelDoc{}).
		Select("model_name", "updated_time").
		Order("model_name").
		Find(&summaries).Error
	return summaries, err
}

func SaveModelDoc(modelName string, content string) (*ModelDoc, error) {
	now := common.GetTimestamp()
	var saved ModelDoc
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing ModelDoc
		err := tx.Where("model_name = ?", modelName).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			saved = ModelDoc{ModelName: modelName, Content: content, UpdatedTime: now}
			return tx.Create(&saved).Error
		}
		if err != nil {
			return err
		}
		if err := tx.Model(&ModelDoc{}).Where("id = ?", existing.Id).
			Updates(map[string]interface{}{"content": content, "updated_time": now}).Error; err != nil {
			return err
		}
		existing.Content = content
		existing.UpdatedTime = now
		saved = existing
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func DeleteModelDoc(modelName string) error {
	return DB.Where("model_name = ?", modelName).Delete(&ModelDoc{}).Error
}

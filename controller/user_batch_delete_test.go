package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type batchDeleteUsersResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Deleted int                       `json:"deleted"`
		Failed  []batchDeleteUsersFailure `json:"failed"`
	} `json:"data"`
}

func setupBatchDeleteUsersTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.TwoFA{},
		&model.TwoFABackupCode{},
		&model.UserSession{},
		&model.AuthFlow{},
		&model.PasskeyCredential{},
		&model.ExternalIdentityClaim{},
		&model.UserOAuthBinding{},
		&model.Log{},
	))
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedis
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func createBatchDeleteTestUser(t *testing.T, db *gorm.DB, username string, role int) *model.User {
	t.Helper()

	user := &model.User{
		Username:    username,
		Password:    "unused-password",
		DisplayName: username,
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     username,
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func callBatchDeleteUsers(t *testing.T, caller *model.User, body string) batchDeleteUsersResponse {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/batch_delete", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", caller.Id)
	c.Set("role", caller.Role)
	c.Set("username", caller.Username)

	BatchDeleteUsers(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response batchDeleteUsersResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestBatchDeleteUsersRejectsInvalidRequests(t *testing.T) {
	db := setupBatchDeleteUsersTestDB(t)
	admin := createBatchDeleteTestUser(t, db, "batch-admin", common.RoleAdminUser)
	victim := createBatchDeleteTestUser(t, db, "batch-victim", common.RoleCommonUser)

	tooMany := make([]string, maxBatchDeleteUsers+1)
	for i := range tooMany {
		tooMany[i] = fmt.Sprint(victim.Id + i)
	}

	tests := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: `{"ids":`},
		{name: "missing ids", body: `{}`},
		{name: "empty ids", body: `{"ids":[]}`},
		{name: "non positive id", body: fmt.Sprintf(`{"ids":[%d,0]}`, victim.Id)},
		{name: "more than the limit", body: `{"ids":[` + strings.Join(tooMany, ",") + `]}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response := callBatchDeleteUsers(t, admin, tt.body)
			assert.False(t, response.Success)
		})
	}

	var remaining int64
	require.NoError(t, db.Model(&model.User{}).Count(&remaining).Error)
	assert.EqualValues(t, 2, remaining)
}

func TestBatchDeleteUsersAppliesDeleteUserPermissionRule(t *testing.T) {
	db := setupBatchDeleteUsersTestDB(t)
	admin := createBatchDeleteTestUser(t, db, "batch-admin", common.RoleAdminUser)
	otherAdmin := createBatchDeleteTestUser(t, db, "batch-other-admin", common.RoleAdminUser)
	root := createBatchDeleteTestUser(t, db, "batch-root", common.RoleRootUser)
	first := createBatchDeleteTestUser(t, db, "batch-bot-1", common.RoleCommonUser)
	second := createBatchDeleteTestUser(t, db, "batch-bot-2", common.RoleCommonUser)
	third := createBatchDeleteTestUser(t, db, "batch-bot-3", common.RoleCommonUser)
	missingId := root.Id + 1000

	body := fmt.Sprintf(`{"ids":[%d,%d,%d,%d,%d,%d,%d,%d,%d]}`,
		first.Id, first.Id, second.Id, otherAdmin.Id, root.Id, admin.Id, missingId, third.Id, second.Id)
	response := callBatchDeleteUsers(t, admin, body)

	require.True(t, response.Success)
	assert.Equal(t, 3, response.Data.Deleted)
	failedIds := make([]int, 0, len(response.Data.Failed))
	for _, failure := range response.Data.Failed {
		assert.NotEmpty(t, failure.Message)
		failedIds = append(failedIds, failure.Id)
	}
	assert.ElementsMatch(t, []int{otherAdmin.Id, root.Id, admin.Id, missingId}, failedIds)

	var remainingIds []int
	require.NoError(t, db.Model(&model.User{}).Order("id").Pluck("id", &remainingIds).Error)
	assert.Equal(t, []int{admin.Id, otherAdmin.Id, root.Id}, remainingIds)

	var auditLogs []model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeManage).Find(&auditLogs).Error)
	assert.Len(t, auditLogs, 3)
	for _, auditLog := range auditLogs {
		assert.Equal(t, admin.Id, auditLog.UserId)
		assert.Contains(t, auditLog.Other, "user.delete")
	}
}

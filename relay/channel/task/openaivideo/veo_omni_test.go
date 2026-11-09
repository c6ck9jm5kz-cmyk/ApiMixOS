package openaivideo

import (
	"bytes"
	"io"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func buildVeoOmniUpstreamPayload(t *testing.T, payload map[string]any) map[string]any {
	t.Helper()
	requestBody, err := common.Marshal(payload)
	require.NoError(t, err)
	c, adaptor, info := newOpenAIVideoRequestContext(t, "/v1/videos", "application/json", bytes.NewReader(requestBody))
	info.ChannelSetting.OpenAIVideoProfile = "veo-omni"
	info.OriginModelName = payload["model"].(string)
	info.UpstreamModelName = payload["model"].(string)
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	encoded, err := io.ReadAll(body)
	require.NoError(t, err)
	var upstream map[string]any
	require.NoError(t, common.Unmarshal(encoded, &upstream))
	return upstream
}

func TestVeoOmniProfileBuildsProviderContract(t *testing.T) {
	tests := []struct {
		name     string
		request  map[string]any
		expected map[string]any
	}{
		{
			name: "gateway reference images become plain reference_images",
			request: map[string]any{
				"model":        "veo-3.1-fast",
				"prompt":       "the person slowly turns and smiles",
				"duration":     8,
				"aspect_ratio": "9:16",
				"resolution":   "1080p",
				"images":       []string{"https://assets.example/a.png", "https://assets.example/b.png"},
			},
			expected: map[string]any{
				"model":            "veo-3.1-fast",
				"prompt":           "the person slowly turns and smiles",
				"duration":         float64(8),
				"aspect_ratio":     "9:16",
				"resolution":       "1080p",
				"reference_images": []any{"https://assets.example/a.png", "https://assets.example/b.png"},
			},
		},
		{
			name: "gateway start and end frames become role-tagged items",
			request: map[string]any{
				"model":           "veo-3.1-quality",
				"prompt":          "push in smoothly from the first frame to the last frame",
				"start_frame_url": "https://assets.example/first.png",
				"end_frame_url":   "https://assets.example/last.png",
			},
			expected: map[string]any{
				"model":        "veo-3.1-quality",
				"prompt":       "push in smoothly from the first frame to the last frame",
				"duration":     float64(8),
				"aspect_ratio": "16:9",
				"resolution":   "720p",
				"reference_images": []any{
					map[string]any{"url": "https://assets.example/first.png", "role": "first_frame"},
					map[string]any{"url": "https://assets.example/last.png", "role": "last_frame"},
				},
			},
		},
		{
			name: "provider-native first frame passes through",
			request: map[string]any{
				"model":            "veo-3.1-lite",
				"prompt":           "a paper boat drifts across a puddle",
				"reference_images": []any{map[string]any{"url": "https://assets.example/first.png", "role": "first_frame"}},
			},
			expected: map[string]any{
				"model":            "veo-3.1-lite",
				"prompt":           "a paper boat drifts across a puddle",
				"duration":         float64(8),
				"aspect_ratio":     "16:9",
				"resolution":       "720p",
				"reference_images": []any{map[string]any{"url": "https://assets.example/first.png", "role": "first_frame"}},
			},
		},
		{
			name: "omni accepts short durations with reference images at 720p",
			request: map[string]any{
				"model":            "omni-1.1-flash",
				"prompt":           "a cat chases a butterfly across the grass",
				"seconds":          "6s",
				"reference_images": []any{"https://assets.example/cat.png"},
			},
			expected: map[string]any{
				"model":            "omni-1.1-flash",
				"prompt":           "a cat chases a butterfly across the grass",
				"duration":         float64(6),
				"aspect_ratio":     "16:9",
				"resolution":       "720p",
				"reference_images": []any{"https://assets.example/cat.png"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, buildVeoOmniUpstreamPayload(t, tt.request))
		})
	}
}

func TestVeoOmniProfileRejectsUnsupportedRequestsBeforeBilling(t *testing.T) {
	tests := []struct {
		name    string
		request map[string]any
		code    string
	}{
		{"veo only supports 8 seconds", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "duration": 5}, "invalid_duration"},
		{"veo does not support 4k", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "resolution": "4k"}, "invalid_video_format"},
		{"omni only supports 720p", map[string]any{"model": "omni-1.1-flash", "prompt": "p", "resolution": "1080p"}, "invalid_video_format"},
		{"omni rejects 12 seconds", map[string]any{"model": "omni-1.1-flash", "prompt": "p", "duration": 12}, "invalid_duration"},
		{"square ratio is unsupported", map[string]any{"model": "veo-3.1-lite", "prompt": "p", "aspect_ratio": "1:1"}, "invalid_video_format"},
		{"quality rejects reference images", map[string]any{"model": "veo-3.1-quality", "prompt": "p", "images": []string{"https://assets.example/a.png"}}, "invalid_images"},
		{"omni rejects first frame", map[string]any{"model": "omni-1.1-flash", "prompt": "p", "start_frame_url": "https://assets.example/a.png"}, "invalid_frame_parameters"},
		{"last frame requires first frame", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "reference_images": []any{map[string]any{"url": "https://assets.example/a.png", "role": "last_frame"}}}, "invalid_frame_parameters"},
		{"frames cannot mix with references", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "reference_images": []any{"https://assets.example/r.png", map[string]any{"url": "https://assets.example/a.png", "role": "first_frame"}}}, "invalid_frame_parameters"},
		{"at most three reference images", map[string]any{"model": "veo-3.1-lite", "prompt": "p", "images": []string{"https://assets.example/1.png", "https://assets.example/2.png", "https://assets.example/3.png", "https://assets.example/4.png"}}, "invalid_images"},
		{"video continuation is not enabled", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "reference_videos": []string{"https://assets.example/v.mp4"}}, "invalid_references"},
		{"unknown frame role", map[string]any{"model": "veo-3.1-fast", "prompt": "p", "reference_images": []any{map[string]any{"url": "https://assets.example/a.png", "role": "middle"}}}, "invalid_reference_images"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requestBody, err := common.Marshal(tt.request)
			require.NoError(t, err)
			c, adaptor, info := newOpenAIVideoRequestContext(t, "/v1/videos", "application/json", bytes.NewReader(requestBody))
			info.ChannelSetting.OpenAIVideoProfile = "veo-omni"
			info.UpstreamModelName = tt.request["model"].(string)
			taskErr := adaptor.ValidateRequestAndSetAction(c, info)
			require.NotNil(t, taskErr)
			assert.Equal(t, tt.code, taskErr.Code)
		})
	}
}

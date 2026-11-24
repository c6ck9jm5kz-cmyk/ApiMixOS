package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeModelDocContent(t *testing.T) {
	tests := []struct {
		name    string
		input   modelDocContent
		want    modelDocContent
		wantErr string
	}{
		{
			name:  "empty mode defaults to auto and blank entries are dropped",
			input: modelDocContent{Notes: []string{"  limit 7000 chars ", "", "   "}, Params: []modelDocParam{{Name: " images ", Type: " array ", Required: true, Description: " up to 9 "}, {Name: "  "}}},
			want:  modelDocContent{Mode: "auto", Notes: []string{"limit 7000 chars"}, Params: []modelDocParam{{Name: "images", Type: "array", Required: true, Description: "up to 9"}}},
		},
		{
			name:  "custom mode keeps markdown",
			input: modelDocContent{Mode: " custom ", Markdown: "# Title"},
			want:  modelDocContent{Mode: "custom", Markdown: "# Title", Notes: []string{}, Params: []modelDocParam{}},
		},
		{
			name:    "unknown mode is rejected",
			input:   modelDocContent{Mode: "html"},
			wantErr: "mode must be auto or custom",
		},
		{
			name:    "too many notes are rejected",
			input:   modelDocContent{Notes: make51Notes()},
			wantErr: "at most 50 notes",
		},
		{
			name:    "overlong parameter name is rejected",
			input:   modelDocContent{Params: []modelDocParam{{Name: strings.Repeat("x", 65)}}},
			wantErr: "too long",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeModelDocContent(tt.input)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func make51Notes() []string {
	notes := make([]string, 51)
	for i := range notes {
		notes[i] = "note"
	}
	return notes
}

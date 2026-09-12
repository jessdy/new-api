package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]any)
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		userGroup, _ := model.GetUserGroup(userId, false)
		user = &model.User{Group: userGroup}
	}
	userUsableGroups := service.GetUserUsableGroupsForUser(user)
	if user.AgentId > 0 {
		for groupName, desc := range userUsableGroups {
			usableGroups[groupName] = map[string]any{
				"ratio": service.GetUserGroupRatioForAgent(user.AgentId, user.Group, groupName),
				"desc":  desc,
			}
		}
	} else {
		for groupName := range ratio_setting.GetGroupRatioCopy() {
			if desc, ok := userUsableGroups[groupName]; ok {
				usableGroups[groupName] = map[string]any{
					"ratio": service.GetUserGroupRatio(user.Group, groupName),
					"desc":  desc,
				}
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]any{
			"ratio": "自动",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}

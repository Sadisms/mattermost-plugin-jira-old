package main

import (
	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	settingOn  = "on"
	settingOff = "off"
)

// handleSettings обновляет настройки и возвращает ответ.
func (p *Plugin) handleSettings(header *model.CommandArgs, instanceID, mattermostUserID types.ID, connection *Connection, args []string, settingType string, helpText string) *model.CommandResponse {
	if len(args) != 2 {
		return p.responsef(header, helpText)
	}

	var value bool
	switch args[1] {
	case settingOn:
		value = true
	case settingOff:
		value = false
	default:
		return p.responsef(header, helpText)
	}

	if connection.Settings == nil {
		connection.Settings = &ConnectionSettings{}
	}

	switch settingType {
	case "notifications":
		connection.Settings.Notifications = value
	case "displayHiddenMessages":
		connection.Settings.DisplayHiddenMessages = value
	default:
		return p.responsef(header, "Invalid setting type.")
	}

	if err := p.userStore.StoreConnection(instanceID, mattermostUserID, connection); err != nil {
		p.errorf("handleSettings, err: %v", err)
		return p.responsef(header, "Could not store new settings. Please contact your system administrator. error: %v", err)
	}

	updatedConnection, err := p.userStore.LoadConnection(instanceID, mattermostUserID)
	if err != nil {
		return p.responsef(header, "Your username is not connected to Jira. Please type `jira connect`. %v", err)
	}

	var responseValue string
	switch settingType {
	case "notifications":
		responseValue = settingOff
		if updatedConnection.Settings.Notifications {
			responseValue = settingOn
		}
	case "displayHiddenMessages":
		responseValue = settingOff
		if updatedConnection.Settings.DisplayHiddenMessages {
			responseValue = settingOn
		}
	}

	return p.responsef(header, "Settings updated. %s %s.", settingType, responseValue)
}

// settingsNotifications обновляет настройки уведомлений.
func (p *Plugin) settingsNotifications(header *model.CommandArgs, instanceID, mattermostUserID types.ID, connection *Connection, args []string) *model.CommandResponse {
	const helpText = "`/jira settings notifications [value]`\n* Invalid value. Accepted values are: `on` or `off`."
	return p.handleSettings(header, instanceID, mattermostUserID, connection, args, "notifications", helpText)
}

// settingsDisplayHiddenMessages обновляет настройки отображения скрытых сообщений.
func (p *Plugin) settingsDisplayHiddenMessages(header *model.CommandArgs, instanceID, mattermostUserID types.ID, connection *Connection, args []string) *model.CommandResponse {
	const helpText = "`/jira settings displayHiddenMessage [value]`\n* Invalid value. Accepted values are: `on` or `off`."
	return p.handleSettings(header, instanceID, mattermostUserID, connection, args, "displayHiddenMessages", helpText)
}

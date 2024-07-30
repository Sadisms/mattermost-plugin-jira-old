// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package main

import (
	"fmt"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

type webhookWorker struct {
	id        int
	p         *Plugin
	workQueue <-chan *webhookMessage
}

type webhookMessage struct {
	InstanceID types.ID
	Data       []byte
}

func (ww webhookWorker) work() {
	for msg := range ww.workQueue {
		err := ww.process(msg)
		if err != nil {
			if errors.Is(err, errWebhookeventUnsupported) {
				ww.p.debugf("WebhookWorker id: %d, error processing, err: %v", ww.id, err)
			} else {
				ww.p.errorf("WebhookWorker id: %d, error processing, err: %v", ww.id, err)
			}
		}
	}
}

func (ww webhookWorker) process(msg *webhookMessage) (err error) {
	defer func() {
		if err == ErrWebhookIgnored {
			// ignore ErrWebhookIgnored - from here up it's a success
			err = nil
		}
	}()
	wh, err := ParseWebhook(msg.Data)

	if err != nil {
		return err
	}

	if _, _, err = wh.PostNotifications(ww.p, msg.InstanceID); err != nil {
		ww.p.errorf("WebhookWorker id: %d, error posting notifications, err: %v", ww.id, err)
	}

	v := wh.(*webhook)
	if err = v.JiraWebhook.expandIssue(ww.p, msg.InstanceID); err != nil {
		return err
	}

	channelsSubscribed, err := ww.p.getChannelsSubscribed(v, msg.InstanceID)
	if err != nil {
		return err
	}

	botUserID := ww.p.getUserID()
	for _, channelSubscribed := range channelsSubscribed {
		// Костыль, нужен для фильтра старых подписок
		if channelSubscribed.MattermostUserID == "" {
			continue
		}

		c, err2 := ww.p.userStore.LoadConnection(msg.InstanceID, types.ID(channelSubscribed.MattermostUserID))
		if err2 == nil {
			if v.User.Self == c.Self {
				continue
			}
		}

		if errCheckPerm := v.CheckPermissions(msg.InstanceID, ww.p, channelSubscribed.MattermostUserID); errCheckPerm != nil {
			ww.p.errorf("WebhookWorker id: %d, error check permissions for %s, err: %v", ww.id, channelSubscribed.MattermostUserID, errCheckPerm)
			continue
		}

		if _, _, err1 := wh.PostToChannel(ww.p, msg.InstanceID, channelSubscribed.ChannelID, botUserID, channelSubscribed.Name); err1 != nil {
			ww.p.errorf("WebhookWorker id: %d, error posting to channel, err: %v", ww.id, err1)
		} else {
			ww.p.API.LogInfo(fmt.Sprintf("Create post notification to user: %s, from subs: %s", channelSubscribed.MattermostUserID, channelSubscribed.ID))
		}
	}

	return nil
}

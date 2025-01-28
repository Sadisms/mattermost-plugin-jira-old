package main

import (
	"encoding/json"
	"fmt"
	"github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
	"github.com/pkg/errors"
	"net/http"
	"slices"
	"strings"
)

func (p *Plugin) checkIsAuthBackdoors(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if !slices.Contains(strings.Split(p.conf.ListBackdoorsBots, ","), userID) {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		handler(w, r)
	}
}

func (p *Plugin) getBackdoorClient(r *http.Request) (Client, error) {
	instanceID, err := validateQueryKey(r, "instance_id")
	if err != nil {
		return nil, err
	}

	userID, err := validateQueryKey(r, "user_id")
	if err != nil {
		return nil, err
	}

	client, _, _, err := p.getClient(types.ID(instanceID), types.ID(userID))
	if err != nil {
		return nil, errors.New(fmt.Sprintf("%s not authorizated", userID))
	}

	return client, nil
}

func (p *Plugin) httpBackdoorCheckUserAuth(w http.ResponseWriter, r *http.Request) (int, error) {
	_, err := p.getBackdoorClient(r)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}
	return respondJSON(w, []string{"OK"})
}

func (p *Plugin) httpBackdoorCreateWorkLog(w http.ResponseWriter, r *http.Request) (int, error) {
	var body struct {
		InstanceID string `json:"instance_id"`
		UserID     string `json:"user_id"`
		IssueKEY   string `json:"issue_key"`
		Minutes    int    `json:"minutes"`
		Comment    string `json:"comment"`
	}
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		return respondErr(w, http.StatusBadRequest,
			errors.New("unmarshall the body"))
	}

	client, _, _, err := p.getClient(types.ID(body.InstanceID), types.ID(body.UserID))
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	workLog, _, err := client.createWorkLog(body.IssueKEY, &jira.WorklogRecord{
		TimeSpentSeconds: body.Minutes * 60,
		Comment:          body.Comment,
	})
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	return respondJSON(w, workLog)
}

func (p *Plugin) httpBackdoorGetIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	issueKey, err := validateQueryKey(r, "issue_key")
	if err != nil {
		return respondErr(w, http.StatusBadRequest, err)
	}
	client, err := p.getBackdoorClient(r)
	if err != nil {
		return respondErr(w, http.StatusUnauthorized, err)
	}

	issue, err := client.GetIssue(issueKey, nil)
	if err != nil {
		return respondErr(w, http.StatusNotFound, err)
	}

	return respondJSON(w, issue)
}

func (p *Plugin) httpBackdoorGetProject(w http.ResponseWriter, r *http.Request) (int, error) {
	projectKey, err := validateQueryKey(r, "project_key")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}
	client, err := p.getBackdoorClient(r)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	project, err := client.GetProject(projectKey)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	return respondJSON(w, project)
}

func (p *Plugin) httpBackdoorCheckCreateWorklogIssue(w http.ResponseWriter, r *http.Request) (int, error) {
	issueKey, err := validateQueryKey(r, "issue_key")
	if err != nil {
		return respondErr(w, http.StatusBadRequest, err)
	}
	client, err := p.getBackdoorClient(r)
	if err != nil {
		return respondErr(w, http.StatusUnauthorized, err)
	}

	permission, err := client.HasWorkLogPermission(issueKey)
	if err != nil {
		return respondErr(w, http.StatusNotFound, err)
	}

	if !permission {
		return respondErr(w, http.StatusNotFound, errors.New("user does not have permission to create worklog"))
	}

	return respondJSON(w, []string{"OK"})
}

package main

import (
	"github.com/andygrunwald/go-jira"
)

func (c JiraClient) createWorkLog(issueID string, record *jira.WorklogRecord) (*jira.WorklogRecord, *jira.Response, error) {
	return c.Jira.Issue.AddWorklogRecord(issueID, record)
}

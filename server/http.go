// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package main

import (
	"encoding/json"
	"fmt"
	"github.com/andygrunwald/go-jira"
	"github.com/mattermost/mattermost/server/public/model"
	htmlTemplate "html/template"
	"regexp"
	textTemplate "text/template"

	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/plugin"

	"github.com/mattermost/mattermost-plugin-jira/server/utils/types"
)

const (
	routeAutocomplete                           = "/autocomplete"
	routeAutocompleteConnect                    = "/connect"
	routeAutocompleteUserInstance               = "/user-instance"
	routeAutocompleteInstalledInstance          = "/installed-instance"
	routeAutocompleteInstalledInstanceWithAlias = "/installed-instance-with-alias"
	routeAPI                                    = "/api/v2"
	routeInstancePath                           = "/instance/{id}"
	routeAPICreateIssue                         = "/create-issue"
	routeAPIGetCreateIssueMetadata              = "/get-create-issue-metadata-for-project"
	routeAPIGetJiraProjectMetadata              = "/get-jira-project-metadata"
	routeAPIGetSearchIssues                     = "/get-search-issues"
	routeAPIGetAutoCompleteFields               = "/get-search-autocomplete-fields"
	routeAPIGetSearchUsers                      = "/get-search-users"
	routeAPIAttachCommentToIssue                = "/attach-comment-to-issue"
	routeAPIUserInfo                            = "/userinfo"
	routeAPISubscribeWebhook                    = "/webhook"
	routeAPISubscriptionsChannel                = "/subscriptions/channel"
	routeAPISubscriptionsChannelWithID          = routeAPISubscriptionsChannel + "/{id:[A-Za-z0-9]+}"
	routeAPISettingsInfo                        = "/settingsinfo"
	routeIssueTransition                        = "/transition"
	routeAPIUserDisconnect                      = "/api/v3/disconnect"
	routeACInstalled                            = "/ac/installed"
	routeACJSON                                 = "/ac/atlassian-connect.json"
	routeACUninstalled                          = "/ac/uninstalled"
	routeACUserRedirectWithToken                = "/ac/user_redirect.html" // #nosec G101
	routeACUserConfirm                          = "/ac/user_confirm.html"
	routeACUserConnected                        = "/ac/user_connected.html"
	routeACUserDisconnected                     = "/ac/user_disconnected.html"
	routeIncomingWebhook                        = "/webhook"
	routeOAuth1Complete                         = "/oauth1/complete.html"
	routeUserStart                              = "/user/start"
	routeUserConnect                            = "/user/connect"
	routeUserDisconnect                         = "/user/disconnect"
	routeGetIssueByKey                          = "/get-issue-by-key"
	routeSharePublicly                          = "/share-issue-publicly"
	routeOAuth2Complete                         = "/oauth2/complete.html"

	routeGetAllSubscriptions = "/all-subscriptions"

	routeParseIssuesInPost       = "/parse-issues-in-post"
	routeCommandIssueTransitions = "/command-issue-transitions"

	routeUpdateIssue             = "/update-issue"
	routeIssueTransitions        = "/issue-transitions"
	routeIssueAvailableAssignees = "/issue-available-assignees"
)

const routePrefixInstance = "instance"

const (
	websocketEventInstanceStatus = "instance_status"
	websocketEventConnect        = "connect"
	websocketEventDisconnect     = "disconnect"
	websocketEventUpdateDefaults = "update_defaults"

	ContentTypeHTML = "text/html; charset=utf-8"
)

func makeAutocompleteRoute(path string) string {
	return routeAutocomplete + path
}

func makeAPIRoute(path string) string {
	return routeAPI + path
}

func (p *Plugin) initializeRouter() {
	p.router = mux.NewRouter()
	p.router.Use(p.withRecovery)

	instanceRouter := p.router.PathPrefix(routeInstancePath).Subrouter()
	p.router.HandleFunc(routeIncomingWebhook, p.handleResponseWithCallbackInstance(p.httpWebhook)).Methods(http.MethodPost)

	// Command autocomplete
	autocompleteRouter := p.router.PathPrefix(routeAutocomplete).Subrouter()
	autocompleteRouter.HandleFunc(routeAutocompleteConnect, p.checkAuth(p.handleResponse(p.httpAutocompleteConnect))).Methods(http.MethodGet)
	autocompleteRouter.HandleFunc(routeAutocompleteUserInstance, p.checkAuth(p.handleResponse(p.httpAutocompleteUserInstance))).Methods(http.MethodGet)
	autocompleteRouter.HandleFunc(routeAutocompleteInstalledInstance, p.checkAuth(p.handleResponse(p.httpAutocompleteInstalledInstance))).Methods(http.MethodGet)
	autocompleteRouter.HandleFunc(routeAutocompleteInstalledInstanceWithAlias, p.checkAuth(p.handleResponse(p.httpAutocompleteInstalledInstanceWithAlias))).Methods(http.MethodGet)

	apiRouter := p.router.PathPrefix(routeAPI).Subrouter()

	// Issue APIs
	apiRouter.HandleFunc(routeAPIGetAutoCompleteFields, p.checkAuth(p.handleResponse(p.httpGetAutoCompleteFields))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPICreateIssue, p.checkAuth(p.handleResponse(p.httpCreateIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPIGetCreateIssueMetadata, p.checkAuth(p.handleResponse(p.httpGetCreateIssueMetadataForProjects))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIGetJiraProjectMetadata, p.checkAuth(p.handleResponse(p.httpGetJiraProjectMetadata))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIGetSearchIssues, p.checkAuth(p.handleResponse(p.httpGetSearchIssues))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIGetSearchUsers, p.checkAuth(p.handleResponse(p.httpGetSearchUsers))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPIAttachCommentToIssue, p.checkAuth(p.handleResponse(p.httpAttachCommentToIssue))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeIssueTransition, p.handleResponse(p.httpTransitionIssuePostAction)).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeSharePublicly, p.handleResponse(p.httpShareIssuePublicly)).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeGetIssueByKey, p.handleResponse(p.httpGetIssueByKey)).Methods(http.MethodGet)

	apiRouter.HandleFunc(routeUpdateIssue, p.handleResponse(p.httpUpdateIssue)).Methods(http.MethodPost)

	// User APIs
	apiRouter.HandleFunc(routeAPIUserInfo, p.checkAuth(p.handleResponse(p.httpGetUserInfo))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPISettingsInfo, p.checkAuth(p.handleResponse(p.httpGetSettingsInfo))).Methods(http.MethodGet)

	// Atlassian Connect application
	instanceRouter.HandleFunc(routeACJSON, p.handleResponseWithCallbackInstance(p.httpACJSON)).Methods(http.MethodGet)
	p.router.HandleFunc(routeACInstalled, p.handleResponse(p.httpACInstalled)).Methods(http.MethodPost)
	p.router.HandleFunc(routeACUninstalled, p.handleResponse(p.httpACUninstalled)).Methods(http.MethodPost)

	// Atlassian Connect user mapping
	instanceRouter.HandleFunc(routeACUserRedirectWithToken, p.handleResponseWithCallbackInstance(p.httpACUserRedirect)).Methods(http.MethodGet)
	instanceRouter.HandleFunc(routeACUserConfirm, p.handleResponseWithCallbackInstance(p.httpACUserInteractive)).Methods(http.MethodGet)
	instanceRouter.HandleFunc(routeACUserConnected, p.handleResponseWithCallbackInstance(p.httpACUserInteractive)).Methods(http.MethodGet)
	instanceRouter.HandleFunc(routeACUserDisconnected, p.handleResponseWithCallbackInstance(p.httpACUserInteractive)).Methods(http.MethodGet)

	// Oauth1 (Jira Server)
	instanceRouter.HandleFunc(routeOAuth1Complete, p.checkAuth(p.handleResponseWithCallbackInstance(p.httpOAuth1aComplete))).Methods(http.MethodGet)
	instanceRouter.HandleFunc(routeUserDisconnect, p.checkAuth(p.handleResponseWithCallbackInstance(p.httpOAuth1aDisconnect))).Methods(http.MethodPost)

	// OAuth2 (Jira Cloud)
	instanceRouter.HandleFunc(routeOAuth2Complete, p.handleResponseWithCallbackInstance(p.httpOAuth2Complete)).Methods(http.MethodGet)

	// User connect/disconnect links
	instanceRouter.HandleFunc(routeUserConnect, p.checkAuth(p.handleResponseWithCallbackInstance(p.httpUserConnect))).Methods(http.MethodGet)
	p.router.HandleFunc(routeUserStart, p.checkAuth(p.handleResponseWithCallbackInstance(p.httpUserStart))).Methods(http.MethodGet)
	p.router.HandleFunc(routeAPIUserDisconnect, p.checkAuth(p.handleResponse(p.httpUserDisconnect))).Methods(http.MethodPost)

	// Firehose webhook setup for channel subscriptions
	instanceRouter.HandleFunc(makeAPIRoute(routeAPISubscribeWebhook), p.handleResponseWithCallbackInstance(p.httpSubscribeWebhook)).Methods(http.MethodPost)

	// To support Plugin v2.x webhook URLs
	apiRouter.HandleFunc(routeAPISubscribeWebhook, p.handleResponseWithCallbackInstance(p.httpSubscribeWebhook)).Methods(http.MethodPost)
	instanceRouter.HandleFunc(routeIncomingWebhook, p.handleResponseWithCallbackInstance(p.httpWebhook)).Methods(http.MethodPost)

	// Channel Subscriptions
	apiRouter.HandleFunc(routeAPISubscriptionsChannelWithID, p.checkAuth(p.handleResponse(p.httpChannelGetSubscriptions))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeAPISubscriptionsChannel, p.checkAuth(p.handleResponse(p.httpChannelCreateSubscription))).Methods(http.MethodPost)
	apiRouter.HandleFunc(routeAPISubscriptionsChannel, p.checkAuth(p.handleResponse(p.httpChannelEditSubscription))).Methods(http.MethodPut)
	apiRouter.HandleFunc(routeAPISubscriptionsChannelWithID, p.checkAuth(p.handleResponse(p.httpChannelDeleteSubscription))).Methods(http.MethodDelete)

	p.router.HandleFunc(routeGetAllSubscriptions, p.checkAuth(p.checkIsAdmin(p.handleResponse(p.getAllSubscriptions)))).Methods(http.MethodGet)

	autocompleteRouter.HandleFunc(routeParseIssuesInPost, p.checkAuth(p.checkIsAdmin(p.handleResponse(p.httpParseIssuesInPost)))).Methods(http.MethodGet)
	autocompleteRouter.HandleFunc(routeCommandIssueTransitions, p.checkAuth(p.checkIsAdmin(p.handleResponse(p.httpCommandIssueTransitions)))).Methods(http.MethodGet)

	apiRouter.HandleFunc(routeIssueTransitions, p.checkAuth(p.handleResponse(p.httpGetIssueTransitions))).Methods(http.MethodGet)
	apiRouter.HandleFunc(routeIssueAvailableAssignees, p.checkAuth(p.handleResponse(p.httpGetIssueAvailableAssignees))).Methods(http.MethodGet)
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	p.router.ServeHTTP(w, r)
}

func (p *Plugin) loadTemplates(dir string) (map[string]*htmlTemplate.Template, map[string]*textTemplate.Template, error) {
	dir = filepath.Clean(dir)
	htmlTemplates := make(map[string]*htmlTemplate.Template)
	textTemplates := make(map[string]*textTemplate.Template)
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		var key string
		if strings.HasSuffix(info.Name(), ".html") { // Check if the content type of template is HTML
			template, err := htmlTemplate.ParseFiles(path)
			if err != nil {
				p.errorf("OnActivate: failed to parse template %s: %v", path, err)
				return nil
			}

			key = path[len(dir):]
			htmlTemplates[key] = template
		} else {
			template, err := textTemplate.ParseFiles(path)
			if err != nil {
				p.errorf("OnActivate: failed to parse the template %s: %v", path, err)
				return nil
			}

			key = path[len(dir):]
			textTemplates[key] = template
		}

		p.debugf("loaded template %s", key)
		return nil
	})
	if err != nil {
		return nil, nil, errors.WithMessage(err, "OnActivate: failed to load templates")
	}
	return htmlTemplates, textTemplates, nil
}

func respondErr(w http.ResponseWriter, code int, err error) (int, error) {
	http.Error(w, err.Error(), code)
	return code, err
}

func respondJSON(w http.ResponseWriter, obj interface{}) (int, error) {
	data, err := json.Marshal(obj)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, errors.WithMessage(err, "failed to marshal response"))
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(data)
	if err != nil {
		return http.StatusInternalServerError, errors.WithMessage(err, "failed to write response")
	}
	return http.StatusOK, nil
}

func (p *Plugin) respondTemplate(w http.ResponseWriter, r *http.Request, contentType string, values interface{}) (int, error) {
	_, path := splitInstancePath(r.URL.Path)
	return p.executeTemplate(w, path, contentType, values)
}

func (p *Plugin) respondSpecialTemplate(w http.ResponseWriter, key string, status int, contentType string, values interface{}) (int, error) {
	return p.executeTemplate(w, key, contentType, values)
}

func (p *Plugin) executeTemplate(w http.ResponseWriter, key string, contentType string, values interface{}) (int, error) {
	w.Header().Set("Content-Type", contentType)
	if contentType == ContentTypeHTML {
		t := p.htmlTemplates[key]
		if t == nil {
			return respondErr(w, http.StatusInternalServerError,
				errors.New("no template found for "+key))
		}

		if err := t.Execute(w, values); err != nil {
			return http.StatusInternalServerError,
				errors.WithMessage(err, "failed to write response")
		}

		return http.StatusOK, nil
	}

	t := p.textTemplates[key]
	if t == nil {
		return respondErr(w, http.StatusInternalServerError,
			errors.New("no template found for "+key))
	}

	if err := t.Execute(w, values); err != nil {
		return http.StatusInternalServerError,
			errors.WithMessage(err, "failed to write response")
	}

	return http.StatusOK, nil
}

func instancePath(route string, instanceID types.ID) string {
	encoded := url.PathEscape(encode([]byte(instanceID)))
	return path.Join("/"+routePrefixInstance+"/"+encoded, route)
}

func splitInstancePath(route string) (instanceURL string, remainingPath string) {
	leadingSlash := ""
	ss := strings.Split(route, "/")
	if len(ss) > 1 && ss[0] == "" {
		leadingSlash = "/"
		ss = ss[1:]
	}

	if len(ss) < 2 {
		return "", route
	}
	if ss[0] != routePrefixInstance {
		return "", route
	}

	id, err := decode(ss[1])
	if err != nil {
		return "", route
	}
	return string(id), leadingSlash + strings.Join(ss[2:], "/")
}

func (p *Plugin) withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if x := recover(); x != nil {
				p.client.Log.Warn("Recovered from a panic",
					"url", r.URL.String(),
					"error", x,
					"stack", string(debug.Stack()))
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) checkAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		handler(w, r)
	}
}

func (p *Plugin) checkIsAdmin(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		user, err := p.API.GetUser(userID)
		if err != nil {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		if !user.IsSystemAdmin() {
			http.Error(w, "Not allowed", http.StatusUnauthorized)
			return
		}
		handler(w, r)
	}
}

func (p *Plugin) handleResponse(fn func(w http.ResponseWriter, r *http.Request) (int, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, err := fn(w, r)

		p.logResponse(r, status, err)
	}
}

func (p *Plugin) handleResponseWithCallbackInstance(fn func(w http.ResponseWriter, r *http.Request, instanceID types.ID) (int, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceURL, _ := splitInstancePath(r.URL.Path)

		callbackInstanceID, err := p.ResolveWebhookInstanceURL(instanceURL)
		if err != nil {
			_, _ = respondErr(w, http.StatusInternalServerError, err)
			return
		}

		status, err := fn(w, r, callbackInstanceID)

		p.logResponse(r, status, err)
	}
}

func (p *Plugin) logResponse(r *http.Request, status int, err error) {
	if status == 0 || status == http.StatusOK {
		return
	}
	if err != nil {
		p.client.Log.Warn("ERROR: ", "Status", strconv.Itoa(status), "Error", err.Error(), "Path", r.URL.Path, "Method", r.Method, "query", r.URL.Query().Encode())
	}

	if status != http.StatusOK {
		p.client.Log.Debug("unexpected plugin response", "Status", strconv.Itoa(status), "Path", r.URL.Path, "Method", r.Method, "query", r.URL.Query().Encode())
	}
}

func (p *Plugin) getAllSubscriptions(w http.ResponseWriter, r *http.Request) (int, error) {
	instances, err := p.instanceStore.LoadInstances()
	var subs []*Subscriptions
	if err != nil {
		return http.StatusBadRequest, err
	}

	for _, id := range instances.IDs() {
		currentSubs, err := p.getSubscriptions(id)
		if err != nil {
			return http.StatusBadRequest, err
		}
		subs = append(subs, currentSubs)
	}

	return respondJSON(w, subs)
}

func validateQueryKey(r *http.Request, key string) (string, error) {
	value := r.URL.Query().Get(key)
	if value == "" {
		return "", errors.New("Not found " + key)
	}

	return value, nil
}

func join(elements []string, separator string) string {
	switch len(elements) {
	case 0:
		return ""
	case 1:
		return elements[0]
	}

	result := elements[0]
	for _, element := range elements[1:] {
		result += separator + element
	}
	return result
}

func (p *Plugin) httpParseIssuesInPost(w http.ResponseWriter, r *http.Request) (int, error) {
	rootID, errRootID := validateQueryKey(r, "root_id")
	if errRootID != nil {
		return respondErr(w, http.StatusInternalServerError, errRootID)
	}

	userInput, err := validateQueryKey(r, "user_input")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	mattermostUserID := types.ID(r.Header.Get("Mattermost-User-Id"))

	instanceURL, _, err := p.parseCommandFlagInstanceURL(strings.Split(userInput, " "))
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	_, instanceID, err := p.ResolveUserInstanceURL(mattermostUserID, instanceURL)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	client, _, _, err := p.getClient(types.ID(instanceID), mattermostUserID)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	post, errPost := p.client.Post.GetPost(rootID)
	if errPost != nil {
		return respondErr(w, http.StatusInternalServerError, errPost)
	}

	lprojects, err := client.ListProjects("", -1, false)
	if errPost != nil {
		return respondErr(w, http.StatusInternalServerError, errPost)
	}

	var projectKyes []string
	for _, project := range lprojects {
		pkey := project.Key
		projectKyes = append(projectKyes, pkey)
	}

	var keys []model.AutocompleteListItem

	pattern := fmt.Sprintf(`(?i)\b(?:%s)-\d+\b`, join(projectKyes, "|"))
	re := regexp.MustCompile(pattern)

	matches := re.FindAllString(post.Message, -1)
	uniqueMatches := make(map[string]bool)
	for _, match := range matches {
		uniqueMatches[match] = true
	}

	for match := range uniqueMatches {
		keys = append(keys, model.AutocompleteListItem{
			Item: match,
		})
	}

	return respondJSON(w, keys)
}

func (p *Plugin) getTransitions(instanceID types.ID, mattermostUserID types.ID, issueKey string) ([]jira.Transition, error) {
	client, _, _, err := p.getClient(instanceID, mattermostUserID)
	if err != nil {
		return nil, fmt.Errorf("failed load client. Error: %v", err)
	}

	transitions, err := client.GetTransitions(issueKey)
	if err != nil {
		return nil, errors.New("we couldn't find the issue key. Please confirm the issue key and try again. You may not have permissions to access this issue")
	}
	if len(transitions) < 1 {
		return nil, errors.New("you do not have the appropriate permissions to perform this action. Please contact your Jira administrator")
	}

	return transitions, nil
}

func (p *Plugin) httpCommandIssueTransitions(w http.ResponseWriter, r *http.Request) (int, error) {
	mattermostUserID := types.ID(r.Header.Get("Mattermost-User-Id"))

	userInput, errRootID := validateQueryKey(r, "user_input")
	if errRootID != nil {
		return respondErr(w, http.StatusInternalServerError, errRootID)
	}

	args := strings.Split(userInput, " ")
	if len(args) < 3 {
		return respondErr(w, http.StatusInternalServerError, errors.New("Failed parse command"))
	}

	issueKey := strings.ToUpper(args[2])

	instanceURL, _, err := p.parseCommandFlagInstanceURL(args)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, fmt.Errorf("failed to load your connection to Jira. Error: %v", err))
	}

	_, instanceID, err := p.ResolveUserInstanceURL(mattermostUserID, instanceURL)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, fmt.Errorf("failed to identify Jira instance %s. Error: %v", instanceURL, err))
	}

	var out []model.AutocompleteListItem

	transitions, errTr := p.getTransitions(instanceID, mattermostUserID, issueKey)
	if errTr != nil {
		return respondErr(w, http.StatusInternalServerError, errTr)
	}

	for _, trans := range transitions {
		out = append(out, model.AutocompleteListItem{
			Item: trans.To.Name,
		})
	}

	return respondJSON(w, out)
}

func (p *Plugin) httpGetIssueTransitions(w http.ResponseWriter, r *http.Request) (int, error) {
	mattermostUserID := types.ID(r.Header.Get("Mattermost-User-Id"))

	instanceID, err := validateQueryKey(r, "instance_id")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	issueKey, err := validateQueryKey(r, "issue_key")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	transitions, errTr := p.getTransitions(types.ID(instanceID), mattermostUserID, issueKey)
	if errTr != nil {
		return respondErr(w, http.StatusInternalServerError, errTr)
	}

	return respondJSON(w, transitions)
}

func (p *Plugin) httpGetIssueAvailableAssignees(w http.ResponseWriter, r *http.Request) (int, error) {
	mattermostUserID := types.ID(r.Header.Get("Mattermost-User-Id"))

	instanceID, err := validateQueryKey(r, "instance_id")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	issueKey, err := validateQueryKey(r, "issue_key")
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	query := r.URL.Query().Get("q")

	client, _, _, err := p.getClient(types.ID(instanceID), mattermostUserID)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	editMeta, err := client.getEditMeta(issueKey)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	if _, ok := editMeta.Fields["assignee"]; !ok {
		return respondErr(w, http.StatusForbidden, fmt.Errorf("user does not have permission to change the assignee"))
	}

	jiraUsers, err := client.SearchUsersAssignableToIssue(issueKey, query, 10)
	if err != nil {
		return respondErr(w, http.StatusInternalServerError, err)
	}

	return respondJSON(w, jiraUsers)
}

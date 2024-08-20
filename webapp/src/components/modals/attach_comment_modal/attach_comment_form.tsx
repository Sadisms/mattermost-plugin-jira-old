// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {Modal} from 'react-bootstrap';

import {Post} from 'mattermost-redux/types/posts';
import {Team} from 'mattermost-redux/types/teams';
import {Theme} from 'mattermost-redux/types/preferences';

import {APIResponse, AttachCommentRequest} from 'types/model';

import {getModalStyles} from 'utils/styles';

import FormButton from 'components/form_button';
import Input from 'components/input';
import JiraIssueSelector from 'components/jira_issue_selector';
import Validator from 'components/validator';

import JiraInstanceAndProjectSelector from 'components/jira_instance_and_project_selector';


type Props = {
    close: () => void;
    attachComment: (payload: AttachCommentRequest) => Promise<APIResponse<{}>>;
    post: Post;
    rootPost: Post;
    currentTeam: Team;
    theme: Theme;
    fetchIssuesKeysByPost: (params: {root_id: string, user_input: string}) => Promise<{data: {Item: string}[]}>;
}


const AttachCommentToIssueForm = (props: Props) => {
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [issueKey, setIssueKey] = useState<string>();
    const [error, setError] = useState<string>();
    const [instanceID, setInstanceID] = useState<string>();

    const validator = new Validator();

    useEffect(() => {
        if (props.rootPost){
            props.fetchIssuesKeysByPost({
                root_id: props.rootPost.id,
                user_input: "_"
            })
                .then(resp => {
                    handleIssueKeyChange(resp.data[0].Item.toUpperCase());
                })
                .catch(e => console.error(e));
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (!validator.validate()) {
            return;
        }

        const issue = {
            post_id: props.post.id,
            current_team: props.currentTeam.name,
            issueKey: issueKey as string,
            instance_id: instanceID as string,
        };
        setSubmitting(true);
        props.attachComment(issue).then(({error}) => {
            if (error) {
                setSubmitting(false);
                setError(error.message);
            } else {
                handleClose();
            }
        });
    };

    const handleClose = (e?: Event) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        props.close();
    };

    const handleIssueKeyChange = (issueKey: string) => {
        setIssueKey(issueKey);
    };

    const {theme} = props;
    const style = getModalStyles(theme);

    const instanceSelector = (
        <JiraInstanceAndProjectSelector
            selectedInstanceID={instanceID}
            selectedProjectID={''}
            hideProjectSelector={true}
            onInstanceChange={(instanceID: string) => setInstanceID(instanceID)}
            onProjectChange={(projectKey: string) => {}}
            theme={props.theme}
            addValidate={validator.addComponent}
            removeValidate={validator.removeComponent}
            onError={(err: string) => setError(err)}
        />
    );

    let form;
    if (instanceID) {
        form = (
            <div>
                <JiraIssueSelector
                    addValidate={validator.addComponent}
                    removeValidate={validator.removeComponent}
                    onChange={handleIssueKeyChange}
                    required={true}
                    theme={theme}
                    error={error}
                    value={issueKey}
                    instanceID={instanceID}
                />
                <Input
                    addValidate={validator.addComponent}
                    removeValidate={validator.removeComponent}
                    label='Message Attached to Jira Issue'
                    type='textarea'
                    isDisabled={true}
                    value={props.post.message}
                    disabled={false}
                    readOnly={true}
                />
            </div>
        );
    }

    const disableSubmit = !(instanceID && issueKey);

    return (
        <form
            role='form'
            onSubmit={handleSubmit}
        >
            <Modal.Body
                style={style.modalBody}
            >
                {instanceSelector}
                {form}
            </Modal.Body>
            <Modal.Footer style={style.modalFooter}>
                <FormButton
                    type='button'
                    btnClass='btn-link'
                    defaultMessage='Cancel'
                    onClick={handleClose}
                />
                <FormButton
                    type='submit'
                    btnClass='btn btn-primary'
                    saving={submitting}
                    defaultMessage='Attach'
                    savingMessage='Attaching'
                    disabled={disableSubmit}
                >
                    {'Attach'}
                </FormButton>
            </Modal.Footer>
        </form>
    );
}

export default AttachCommentToIssueForm;
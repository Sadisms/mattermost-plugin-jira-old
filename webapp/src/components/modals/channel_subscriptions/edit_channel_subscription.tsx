// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {Modal} from 'react-bootstrap';

import ReactSelectSetting from 'components/react_select_setting';
import ConfirmModal from 'components/confirm_modal';
import FormButton from 'components/form_button';
import Input from 'components/input';
import Loading from 'components/loading';
import Validator from 'components/validator';
import JiraInstanceAndProjectSelector from 'components/jira_instance_and_project_selector';

import {getModalStyles} from 'utils/styles';
import {
    getCustomFieldValuesForEvents,
    getCustomFieldFiltersForProjects,
    getConflictingFields,
} from 'utils/jira_issue_metadata';

import {ChannelSubscription, ChannelSubscriptionFilters as ChannelSubscriptionFiltersModel, ReactSelectOption, FilterValue, IssueMetadata} from 'types/model';

import {SharedProps} from './shared_props';


const JiraEventOptions: ReactSelectOption[] = [
    {value: 'event_created', label: 'Issue Created'},
    {value: 'event_deleted', label: 'Issue Deleted'},
    // {value: 'event_deleted_unresolved', label: 'Issue Deleted, Unresolved'},
    // {value: 'event_updated_reopened', label: 'Issue Reopened'},
    {value: 'event_updated_resolved', label: 'Issue Resolved'},
    {value: 'event_created_comment', label: 'Comment Created'},
    {value: 'event_updated_comment', label: 'Comment Updated'},
    {value: 'event_deleted_comment', label: 'Comment Deleted'},
    {value: 'event_updated_any', label: 'Issue Updated: Any'},
    // {value: 'event_updated_affects_version', label: 'Issue Updated: Affects Version'},
    {value: 'event_updated_assignee', label: 'Issue Updated: Assignee'},
    {value: 'event_updated_attachment', label: 'Issue Updated: Attachment'},
    {value: 'event_updated_description', label: 'Issue Updated: Description'},
    {value: 'event_updated_fix_version', label: 'Issue Updated: Fix Version'},
    // {value: 'event_updated_issue_type', label: 'Issue Updated: Issue Type'},
    {value: 'event_updated_labels', label: 'Issue Updated: Labels'},
    {value: 'event_updated_priority', label: 'Issue Updated: Priority'},
    // {value: 'event_updated_rank', label: 'Issue Updated: Rank'},
    // {value: 'event_updated_reporter', label: 'Issue Updated: Reporter'},
    {value: 'event_updated_sprint', label: 'Issue Updated: Sprint'},
    {value: 'event_updated_status', label: 'Issue Updated: Status'},
    {value: 'event_updated_summary', label: 'Issue Updated: Summary'},
    {value: 'event_updated_components', label: 'Issue Updated: Components'},
];

const MeRoles: ReactSelectOption[] = [
    {label: 'Assignee', value: 'assignee'},
    {label: 'Reporter', value: 'reporter'},
    {label: 'Watcher', value: 'watcher'},
]

export type Props = SharedProps & {
    finishEditSubscription: () => void;
    selectedSubscription: ChannelSubscription | null;
    creatingSubscription: boolean;
};

export type State = {
    filters: ChannelSubscriptionFiltersModel;
    instanceID: string;
    fetchingIssueMetadata: boolean;
    jiraIssueMetadata: IssueMetadata | null;
    error: string | null;
    getMetaDataErr: string | null;
    submitting: boolean;
    subscriptionName: string | null;
    showConfirmModal: boolean;
    conflictingError: string | null;
};

export default class EditChannelSubscription extends PureComponent<Props, State> {
    private validator: Validator;

    constructor(props: Props) {
        super(props);

        let filters: ChannelSubscriptionFiltersModel = {
            events: [],
            projects: [],
            issue_types: [],
            fields: [],
            self: []
        };

        let subscriptionName = null;
        if (props.selectedSubscription) {
            filters = Object.assign({}, filters, props.selectedSubscription.filters);
            subscriptionName = props.selectedSubscription.name;
        }

        filters.fields = filters.fields || [];

        let instanceID = '';
        if (this.props.selectedSubscription) {
            instanceID = this.props.selectedSubscription.instance_id;
        }


        this.state = {
            error: null,
            getMetaDataErr: null,
            submitting: false,
            filters,
            jiraIssueMetadata: null,
            subscriptionName,
            showConfirmModal: false,
            conflictingError: null,
            instanceID,
        };

        this.validator = new Validator();
    }

    handleClose = (e?: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        this.props.finishEditSubscription();
    };

    handleNameChange = (id: string, value: string) => {
        this.setState({subscriptionName: value});
    };

    deleteChannelSubscription = () => {
        if (this.props.selectedSubscription) {
            this.props.deleteChannelSubscription(this.props.selectedSubscription).then((res) => {
                if (res.error) {
                    this.setState({error: res.error.message});
                } else {
                    this.handleClose();
                }
            });
        }
    };

    handleCancelDelete = () => {
        this.setState({showConfirmModal: false});
    }

    handleConfirmDelete = () => {
        this.setState({showConfirmModal: false});
        this.deleteChannelSubscription();
    }

    handleDeleteChannelSubscription = (): void => {
        this.setState({showConfirmModal: true});
    };

    handleSettingChange = (id: keyof ChannelSubscriptionFiltersModel, value: string[]) => {
        let finalValue = value;
        if (!finalValue) {
            finalValue = [];
        } else if (!Array.isArray(finalValue)) {
            finalValue = [finalValue];
        }
        const filters = {...this.state.filters};
        filters[id] = finalValue;
        this.setState({filters});
        this.clearConflictingErrorMessage();
    };

    clearConflictingErrorMessage = () => {
        this.setState({conflictingError: null});
    }

    handleIssueChange = (id: keyof ChannelSubscriptionFiltersModel, value: string[] | null) => {
        const finalValue = value || [];
        const filters = {...this.state.filters, issue_types: finalValue};

        let conflictingFields = null;
        if (finalValue.length > this.state.filters.issue_types.length) {
            const filterFields = getCustomFieldFiltersForProjects(this.state.jiraIssueMetadata, this.state.filters.projects, this.state.filters.issue_types);
            conflictingFields = getConflictingFields(
                filterFields,
                finalValue,
                this.state.jiraIssueMetadata
            );
        }

        if (conflictingFields && conflictingFields.length) {
            const selectedConflictingFields = conflictingFields.filter((f1) => {
                return this.state.filters.fields.find((f2) => f1.field.key === f2.key);
            });

            if (selectedConflictingFields.length) {
                const fieldsStr = selectedConflictingFields.map((cf) => cf.field.name).join(', ');
                const conflictingIssueType = conflictingFields[0].issueTypes[0];

                let errorStr = `Issue Type(s) "${conflictingIssueType.name}" does not have filter field(s): "${fieldsStr}".  `;
                errorStr += 'Please update the conflicting fields or create a separate subscription.';
                this.setState({conflictingError: errorStr});
                return;
            }
        }

        this.setState({filters, conflictingError: null});
    };

    handleJiraInstanceChange = (instanceID: string) => {
        if (instanceID === this.state.instanceID) {
            return;
        }

        this.setState({instanceID, error: null});
        this.handleProjectChange('');
    }

    handleProjectChange = (projectID: string) => {
        this.clearConflictingErrorMessage();

        let projects: string[];
        if (projectID) {
            projects = projectID;
        } else {
            projects = [];
        }

        if (projects.length && this.state.filters.projects === projects) {
            return;
        }

        const filters = {
            projects,
            issue_types: [],
            events: [],
            fields: [],
        };

        this.setState({
            getMetaDataErr: null,
            filters,
        });
    };

    handleFilterFieldChange = (fields: FilterValue[]) => {
        this.setState({filters: {...this.state.filters, fields}});
        this.clearConflictingErrorMessage();
    };

    handleCreate = (e?: React.FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        if (!this.validator.validate()) {
            return;
        }

        const subscription = {
            channel_id: this.props.channel.id,
            filters: this.state.filters,
            name: this.state.subscriptionName,
            instance_id: this.state.instanceID,
        } as ChannelSubscription;

        this.setState({submitting: true, error: null});

        if (this.props.selectedSubscription) {
            subscription.id = this.props.selectedSubscription.id;
            this.props.editChannelSubscription(subscription).then((edited) => {
                if (edited.error) {
                    this.setState({error: edited.error.message, submitting: false});
                    return;
                }
                this.handleClose(e);
            });
        } else {
            this.props.createChannelSubscription(subscription).then((created) => {
                if (created.error) {
                    this.setState({error: created.error.message, submitting: false});
                    return;
                }
                this.handleClose(e);
            });
        }
    };


    render(): JSX.Element {
        const style = getModalStyles(this.props.theme);

        const customFields = getCustomFieldValuesForEvents(this.state.jiraIssueMetadata, this.state.filters.projects);
        const eventOptions = JiraEventOptions.concat(customFields);

        let conflictingErrorComponent = null;
        if (this.state.conflictingError) {
            conflictingErrorComponent = (
                <p className='help-text error-text'>
                    <span>{this.state.conflictingError}</span>
                </p>
            );
        }

        let component = null;
        if (this.props.channel && this.props.channelSubscriptions) {
            let innerComponent = null;
            if (this.state.filters.projects[0]) {
                innerComponent = (
                    <React.Fragment>
                        <ReactSelectSetting
                            name={'events'}
                            label={'Events'}
                            required={true}
                            onChange={this.handleSettingChange}
                            options={eventOptions}
                            isMulti={true}
                            theme={this.props.theme}
                            value={eventOptions.filter((option) => this.state.filters.events.includes(option.value))}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                            closeMenuOnSelect={false}
                        />
                        {conflictingErrorComponent}
                        <ReactSelectSetting
                            isMulti
                            required
                            name={'self'}
                            label={'Me role'}
                            theme={this.props.theme}
                            options={MeRoles}
                            placeholder={'Choose your role in the tasks you want to receive alerts on.'}
                            onChange={this.handleSettingChange}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                            value={MeRoles.filter(option => (this.state.filters.self || []).includes(option.value))}
                            closeMenuOnSelect={false}
                        />
                    </React.Fragment>
                );
            }

            component = (
                <React.Fragment>
                    <div className='container-fluid'>
                        <Input
                            label={'Subscription Name'}
                            placeholder={'Name'}
                            type={'input'}
                            maxLength={100}
                            required={true}
                            onChange={this.handleNameChange}
                            value={this.state.subscriptionName}
                            readOnly={false}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                    </div>
                    <div className='container-fluid'>
                        <JiraInstanceAndProjectSelector
                            selectedInstanceID={this.state.instanceID}
                            selectedProjects={this.state.filters.projects}
                            onInstanceChange={this.handleJiraInstanceChange}
                            onProjectChange={this.handleProjectChange}
                            onError={(error: string) => this.setState({error})}
                            theme={this.props.theme}
                            addValidate={this.validator.addComponent}
                            removeValidate={this.validator.removeComponent}
                        />
                        {innerComponent}
                    </div>
                </React.Fragment>
            );
        } else {
            component = <Loading/>;
        }

        const {showConfirmModal} = this.state;

        let confirmDeleteMessage = 'Delete Subscription?';
        if (this.props.selectedSubscription && this.props.selectedSubscription.name) {
            confirmDeleteMessage = `Delete Subscription "${this.props.selectedSubscription.name}"?`;
        }

        let confirmComponent;
        if (this.props.selectedSubscription) {
            confirmComponent = (
                <ConfirmModal
                    cancelButtonText={'Cancel'}
                    confirmButtonText={'Delete'}
                    confirmButtonClass={'btn btn-danger'}
                    hideCancel={false}
                    message={confirmDeleteMessage}
                    onCancel={this.handleCancelDelete}
                    onConfirm={this.handleConfirmDelete}
                    show={showConfirmModal}
                    title={'Subscription'}
                />
            );
        }

        let error = null;
        if (this.state.error) {
            error = (
                <p className='help-text error-text'>
                    <span>{this.state.error}</span>
                </p>
            );
        }

        const enableSubmitButton = Boolean(this.state.filters.projects[0]);
        const enableDeleteButton = Boolean(this.props.selectedSubscription);

        let saveSubscriptionButtonText = 'Save Subscription';
        let headerText = 'Edit Jira Subscription';
        if (this.props.creatingSubscription) {
            headerText = 'Add Jira Subscription';
            saveSubscriptionButtonText = 'Add Subscription';
        }

        return (
            <form
                role='form'
            >
                <div className='margin-bottom x3 text-center'>
                    <h2>{headerText}</h2>
                </div>
                <div style={style.modalBody}>
                    {component}
                    {error}
                    {confirmComponent}
                </div>
                <Modal.Footer style={style.modalFooter}>
                    <FormButton
                        id='jira-delete-subscription'
                        type='button'
                        btnClass='btn-danger pull-left'
                        defaultMessage='Delete'
                        disabled={!enableDeleteButton}
                        onClick={this.handleDeleteChannelSubscription}
                    />
                    <FormButton
                        type='button'
                        btnClass='btn-link'
                        defaultMessage='Cancel'
                        onClick={this.handleClose}
                    />
                    <FormButton
                        type='button'
                        onClick={this.handleCreate}
                        disabled={!enableSubmitButton}
                        btnClass='btn-primary'
                        saving={this.state.submitting}
                        defaultMessage={saveSubscriptionButtonText}
                        savingMessage='Saving...'
                    />
                </Modal.Footer>
            </form>
        );
    }
}

const getStyle = (theme: any): any => ({
    modalBody: {
        padding: '2em 0',
        color: theme.centerChannelColor,
        backgroundColor: theme.centerChannelBg,
    },
    modalFooter: {
        padding: '2rem 15px',
    },
    descriptionArea: {
        height: 'auto',
        width: '100%',
        color: '#000',
    },
});

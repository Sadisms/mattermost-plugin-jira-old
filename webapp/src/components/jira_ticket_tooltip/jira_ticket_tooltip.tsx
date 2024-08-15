import React, { useState, useEffect, ReactNode } from 'react';
import { Instance } from 'types/model';
import { TicketData, TicketDetails } from 'types/tooltip';
import './ticketStyle.scss';
import { getJiraTicketDetails } from 'utils/jira_issue_metadata';
import JiraTransitionSelector from "../data_selectors/jira_transition_selector";
import DefaultAvatar from "../default_avatar/default_avatar";

export type Props = {
    href: string;
    show: boolean;
    connected: boolean;
    connectedInstances: Instance[];
    fetchIssueByKey: (issueKey: string, instanceID: string) => Promise<{ data?: TicketData }>;
    fetchTransitionsByIssue: (issueKey: string, instanceID: string) => Promise<{ data?: string[] }>;
    updateIssue: (instanceID: string, issueKey: string, transition: string) => Promise<{ data?: string[] }>;
};

const isAssignedLabel = ' is assigned';
const unAssignedLabel = 'Unassigned';
const jiraTicketSummaryMaxLength = 80;
const maxTicketDescriptionLength = 160;

enum MyStatus {
    INDETERMINATE = 'indeterminate',
    DONE = 'done',
}

const myStatusClasses: Record<string, string> = {
    [MyStatus.INDETERMINATE]: 'ticket-status--indeterminate',
    [MyStatus.DONE]: 'ticket-status--done',
};


const TicketPopover: React.FC<Props> = (props: Props) => {
    const [ticketId, setTicketId] = useState<string>('');
    const [instanceId, setInstanceId] = useState<string>('');
    const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null);
    const [isUpdateIssue, setIsUpdateIssue] = useState<boolean>(false);
    const [errorFetchTransitions, setErrorFetchTransitions] = useState<boolean>(false);

    const getIssueKey = () => {
        let ticketID = '';
        let instanceID = '';

        for (const instance of props.connectedInstances) {
            instanceID = instance.instance_id;

            if (!props.href.includes(instanceID)) {
                continue;
            }

            try {
                const regex = /(https|http):\/\/.*\/.*\?.*selectedIssue=([\w-]+)&?.*|(https|http):\/\/.*\/browse\/([\w-]+)?.*/;
                const result = regex.exec(props.href);
                if (result) {
                    ticketID = result[2] || result[4];
                    return { ticketID, instanceID };
                }
                break;
            } catch (e) {
                break;
            }
        }

        return null;
    }

    const fetchIssue = async () => {
        const issueKey = getIssueKey();
        if (!issueKey) return;

        const { instanceID } = issueKey;
        if (!ticketDetails && props.show && ticketId) {
            const res = await props.fetchIssueByKey(ticketId, instanceID);
            const updatedTicketDetails = getJiraTicketDetails(res.data);
            if (props.connected && updatedTicketDetails && updatedTicketDetails.ticketId.toUpperCase() === ticketId.toUpperCase()) {
                setTicketDetails(updatedTicketDetails);
            }
        }
    }

    useEffect(() => {
        const issueKey = getIssueKey();
        if (issueKey) {
            setTicketId(issueKey.ticketID);
            setInstanceId(issueKey.instanceID);
        }
    }, [props.href, props.connectedInstances]);

    useEffect(() => {
        fetchIssue();
    }, [ticketId, props.show]);

    const fixVersionLabel = (fixVersion: string) => {
        if (fixVersion) {
            const fixVersionString = 'Fix Version :';
            return (
                <div className='fix-version-label'>
                    {fixVersionString}
                    <span className='fix-version-label-value'>
                        {fixVersion}
                    </span>
                </div>
            );
        }
        return null;
    }

    const handleUpdateIssue = async (transition: string) => {
        setIsUpdateIssue(true);
        try {
            await props.updateIssue(instanceId, ticketId, transition);
            setTicketDetails({...ticketDetails, statusKey: transition});
        } finally {
            setIsUpdateIssue(false);
        }
    }

    const tagTicketStatus = (ticketStatus: string) => {
        let ticketStatusClass = 'default-style ticket-status--default';

        const myStatusClass = myStatusClasses[ticketStatus && ticketStatus.toLowerCase()];
        if (myStatusClass) {
            ticketStatusClass = 'default-style ' + myStatusClass;
        }

        return <span className={ticketStatusClass}>{ticketStatus}</span>;
    }

    const renderLabelList = (labels: string[]) => {
        if (!labels || !labels.length) return null;

        return (
            <div className='popover-labels__label'>
                {
                    labels.map((label, key) => {
                        if (key < 3) {
                            return (
                                <span
                                    key={key}
                                    className='popover-labels__label-list'
                                >
                                    {label}
                                </span>
                            );
                        }
                        if (key === labels.length - 1 && labels.length > 3) {
                            return (
                                <span
                                    key={key}
                                    className='popover-labels__label-list'
                                >
                                    {`+${labels.length - 3} more`}
                                </span>
                            );
                        }
                        return null;
                    })
                }
            </div>
        );
    }

    if (!ticketId || (!ticketDetails && !props.show)) return null;

    if (!ticketDetails || isUpdateIssue) {
        return (
            <div className='jira-issue-tooltip jira-issue-tooltip-loading'>
                <span
                    className='jira-issue-spinner fa fa-spin fa-spinner'
                    title={'Loading Icon'}
                />
            </div>
        );
    }
    return (
        <div className='jira-issue-tooltip'>
            <div className='popover-header'>
                <div className='popover-header__container'>
                    <a
                        href={props.href}
                        className='popover-header__keyword'
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <span className='jira-ticket-key'>{ticketDetails.ticketId}</span>
                        <img
                            alt='jira-issue-icon'
                            width='14'
                            height='14'
                            src={ticketDetails.issueIcon}
                        />
                    </a>
                </div>
            </div>
            <div className='popover-body'>
                <div className='popover-body__title'>
                    <a
                        href={props.href}
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <h5>{ticketDetails.summary && ticketDetails.summary.substring(0, jiraTicketSummaryMaxLength)}</h5>
                    </a>
                </div>
                <div className='popover-body__description'>
                    {ticketDetails.description && `${ticketDetails.description.substring(0, maxTicketDescriptionLength).trim()}${ticketDetails.description.length > maxTicketDescriptionLength ? '...' : ''}`}
                </div>
                <div className='popover-body__see-more-link'>
                    <a
                        href={props.href}
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        {'See more'}
                    </a>
                </div>
                <div className='popover-body__labels'>
                    {fixVersionLabel(ticketDetails.versions)}
                    {renderLabelList(ticketDetails.labels)}
                </div>
                <div className='popover-footer'>
                    {ticketDetails.assigneeAvatar ? (
                        <img
                            className='popover-footer__assignee-profile'
                            src={ticketDetails.assigneeAvatar}
                            alt='jira assignee profile'
                        />
                    ) : <DefaultAvatar />}
                    {ticketDetails.assigneeName ? (
                        <span>
                            <span className='popover-footer__assignee-name'>
                                {ticketDetails.assigneeName}
                            </span>
                            <span>
                                {isAssignedLabel}
                            </span>
                        </span>
                    ) : (
                        <span>
                            {unAssignedLabel}
                        </span>
                    )}
                </div>
                <div className='popover-body__actions'>
                    {
                        errorFetchTransitions ? tagTicketStatus(ticketDetails.statusKey) :
                            <JiraTransitionSelector
                                label="Transition"
                                issueKey={ticketDetails.ticketId}
                                value={ticketDetails.statusKey}
                                instanceID={instanceId}
                                projectKey={ticketDetails.project.key}
                                isMulti={false}
                                theme={{ ...props.theme, width: "200px" }}
                                target={null}
                                onChange={v => handleUpdateIssue(v)}
                                handleError={setErrorFetchTransitions}
                            />
                    }
                </div>
            </div>
        </div>
    );
}

export default TicketPopover;

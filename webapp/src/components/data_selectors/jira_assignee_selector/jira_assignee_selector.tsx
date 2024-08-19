import React, { useState, useEffect } from 'react';
import BackendSelector, {Props as BackendSelectorProps} from '../backend_selector';
import {AvatarSize, JiraUser, ReactSelectOption} from "../../../types/model";


type Props = BackendSelectorProps & {
    getAvailableAssigneesByIssue: (params: {issue_key: string; instance_id: string, q: string | undefined}) => (
        Promise<{data: JiraUser[]; error?: Error}>
    );
    issueKey: string,
    handleError: (error: symbol) => void
}



const JiraAssigneeSelector = (props: Props) => {
    const [error, setError] = useState(null);

    useEffect(() => {
        props.handleError(error);
    }, [error]);

    const allAssigneesByIssue = async (): Promise<ReactSelectOption[]> => {
        if (!props.value || (props.isMulti && !props.value.length)) {
            return [];
        }

        return getAssigneeByIssue("");
    };

    const getAssigneeByIssue = (inputValue: string) => {
        const params = {
            issue_key: props.issueKey,
            instance_id: props.instanceID,
            q: inputValue
        }

        return props.getAvailableAssigneesByIssue(params)
            .then(({data, error}) => {
                if (error) {
                    return;
                }

                return data.map((user) => {
                    let label: string | React.ReactElement = user.displayName;
                    const avatarURL = user.avatarUrls[AvatarSize.SMALL];
                    if (avatarURL) {
                        label = (
                            <span>
                            <img
                                src={avatarURL}
                                style={{width: '24px', marginRight: '10px'}}
                            />
                            <span>{user.displayName}</span>
                        </span>
                        );
                    }

                    return {
                        value: user.key,
                        label
                    }
                });
            }).catch((e) => {
                console.error(e);
                setError(true);
            });
    }

    return (
        <BackendSelector
            {...props}
            fetchInitialSelectedValues={allAssigneesByIssue}
            search={getAssigneeByIssue}
        />
    );
}

export default JiraAssigneeSelector;
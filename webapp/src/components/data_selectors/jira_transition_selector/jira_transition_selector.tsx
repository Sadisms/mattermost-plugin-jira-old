import React, { useState, useEffect } from 'react';
import BackendSelector, {Props as BackendSelectorProps} from '../backend_selector';
import {ReactSelectOption} from "../../../types/model";


type Props = BackendSelectorProps & {
    getTransitionsByIssue: (params: {issue_key: string; instance_id: string}) => (
        Promise<{data: {to: {name: string}}[]; error?: Error}>
    );
    issueKey: string,
    handleError: (error: symbol) => void
}



const JiraTransitionSelector = (props: Props) => {
    const [error, setError] = useState(null);

    useEffect(() => {
        props.handleError(error);
    }, [error]);

    const allTransitionsByIssue = async (): Promise<ReactSelectOption[]> => {
        if (!props.value || (props.isMulti && !props.value.length)) {
            return [];
        }

        return getTransitionsByIssue("");
    };

    const filterTransitions = (tr: ReactSelectOption[], inputValue: string) => {
        if (inputValue.length > 0) return tr.filter(tr => tr.value === inputValue);
        return tr;
    }

    const getTransitionsByIssue = (inputValue: string) => {
        const params = {
            issue_key: props.issueKey,
            instance_id: props.instanceID
        }

        return props.getTransitionsByIssue(params)
            .then(({data, error}) => {
                if (error) {
                    return;
                }
                return filterTransitions(data.map((transition) => ({
                    value: transition.to.name,
                    label: transition.to.name,
                })), inputValue);
            }).catch((e) => {
                console.error(e);
                setError(true);
            });
    }

    return (
        <BackendSelector
            {...props}
            fetchInitialSelectedValues={allTransitionsByIssue}
            search={getTransitionsByIssue}
        />
    );
}

export default JiraTransitionSelector;
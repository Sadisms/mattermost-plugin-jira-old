// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Component} from 'react';
import PropTypes from 'prop-types';

import debounce from 'debounce-promise';
import AsyncSelect from 'react-select/async';

import {getStyleForReactSelect} from 'utils/styles';

const searchDebounceDelay = 400;

export default class JiraIssueSelector extends Component {
    static propTypes = {
        required: PropTypes.bool,
        theme: PropTypes.object.isRequired,
        onChange: PropTypes.func.isRequired,
        searchIssues: PropTypes.func.isRequired,
        error: PropTypes.string,
        value: PropTypes.string,
        addValidate: PropTypes.func.isRequired,
        removeValidate: PropTypes.func.isRequired,
        instanceID: PropTypes.string.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            invalid: false,
            serverError: null,
            selectedValue: null,
        };

        this.debouncedSearchIssues = debounce(this.searchIssues, searchDebounceDelay);
    }

    componentDidMount() {
        if (this.props.addValidate) {
            this.props.addValidate(this.isValid);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.value !== this.props.value && this.state.invalid) {
            this.setState({invalid: false});
        }

        if (this.props.value && !this.state.selectedValue) {
            this.handleIssueSearchTermChange(this.props.value).then((options) => {
                const matchedOption = options.find(option => option.value === this.props.value);
                this.setState({
                    selectedValue: matchedOption || {value: this.props.value, label: this.props.value},
                });
            });
        }
    }

    componentWillUnmount() {
        if (this.props.removeValidate) {
            this.props.removeValidate(this.isValid);
        }
    }

    handleIssueSearchTermChange = (inputValue) => {
        return this.debouncedSearchIssues(inputValue);
    };

    searchIssues = (text) => {
        const params = {
            fields: 'key,summary',
            q: text.trim(),
            instance_id: this.props.instanceID,
        };

        return this.props.searchIssues(params).then(({data}) => {
            if (!data){
                return [];
            }

            return data.map((issue) => ({
                value: issue.key,
                label: `${issue.key}: ${issue.fields.summary}`,
            }));
        }).catch((e) => {
            this.setState({serverError: e});
        });
    };

    onChange = (e) => {
        const value = e ? e.value : '';
        this.props.onChange(value);
        this.setState({selectedValue: e});
    };

    isValid = () => {
        if (!this.props.required) {
            return true;
        }

        const valid = this.props.value && this.props.value.toString().length !== 0;
        this.setState({invalid: !valid});
        return valid;
    };

    render() {
        const {error, theme, required} = this.props;
        const {serverError, selectedValue} = this.state;

        const requiredStar = required ? (
            <span className={'error-text'} style={{marginLeft: '3px'}}>
                {'*'}
            </span>
        ) : null;

        const issueError = error ? (
            <p className='help-text error-text'>
                <span>{error}</span>
            </p>
        ) : null;

        const errComponent = serverError ? (
            <p className='alert alert-danger'>
                <i className='fa fa-warning' title='Warning Icon'/>
                <span>{serverError.toString()}</span>
            </p>
        ) : null;

        const validationError = required && this.state.invalid ? (
            <p className='help-text error-text'>
                <span>This field is required.</span>
            </p>
        ) : null;

        return (
            <div className={'form-group less'}>
                {errComponent}
                <label className={'control-label'} htmlFor={'issue'}>
                    {'Jira Issue'}
                </label>
                {requiredStar}
                <AsyncSelect
                    name={'issue'}
                    placeholder={'Search for issues containing text...'}
                    onChange={this.onChange}
                    required={true}
                    disabled={false}
                    isMulti={false}
                    isClearable={true}
                    loadOptions={this.handleIssueSearchTermChange}
                    menuPortalTarget={document.body}
                    menuPlacement='auto'
                    styles={getStyleForReactSelect(theme)}
                    value={selectedValue}
                />
                {validationError}
                {issueError}
            </div>
        );
    }
}

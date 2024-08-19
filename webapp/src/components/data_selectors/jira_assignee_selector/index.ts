import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getAvailableAssigneesByIssue} from 'actions';

import JiraAssigneeSelector from './jira_assignee_selector';

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    getAvailableAssigneesByIssue
}, dispatch);

export default connect(null, mapDispatchToProps)(JiraAssigneeSelector);

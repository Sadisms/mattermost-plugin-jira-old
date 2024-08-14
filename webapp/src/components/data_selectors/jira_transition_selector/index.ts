import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getTransitionsByIssue} from 'actions';

import JiraTransitionSelector from './jira_transition_selector';

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    getTransitionsByIssue
}, dispatch);

export default connect(null, mapDispatchToProps)(JiraTransitionSelector);

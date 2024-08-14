import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';
import {GlobalState} from 'mattermost-redux/types/store';

import {isUserConnected, getUserConnectedInstances} from 'selectors';
import {fetchIssueByKey, updateIssue} from 'actions';

import TicketPopover from './jira_ticket_tooltip';

const mapStateToProps = (state: GlobalState) => {
    return {
        connected: isUserConnected(state),
        connectedInstances: getUserConnectedInstances(state),
        theme: JSON.parse(state.entities.preferences.myPreferences["theme--"].value)
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    fetchIssueByKey,
    updateIssue,
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(TicketPopover);

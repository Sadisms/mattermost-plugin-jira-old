// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {closeAttachCommentToIssueModal, attachCommentToIssue, fetchIssuesKeysByPost} from 'actions';
import {isAttachCommentToIssueModalVisible, getAttachCommentToIssueModalForPostId} from 'selectors';

import AttachCommentToIssueModal from './attach_comment_modal';

const mapStateToProps = (state) => {
    const postId = getAttachCommentToIssueModalForPostId(state);
    const post = getPost(state, postId);
    const currentTeam = getCurrentTeam(state);

    let rootPost = null;
    if (post && post.root_id){
        rootPost = getPost(state, post.root_id);
    }

    return {
        visible: isAttachCommentToIssueModalVisible(state),
        post,
        currentTeam,
        rootPost
    };
};

const mapDispatchToProps = (dispatch) => bindActionCreators({
    close: closeAttachCommentToIssueModal,
    attachComment: attachCommentToIssue,
    fetchIssuesKeysByPost
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(AttachCommentToIssueModal);

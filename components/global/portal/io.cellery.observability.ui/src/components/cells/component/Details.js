/*
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ComponentDependencyView from "./ComponentDependencyView";
import HealthIndicator from "../../common/HealthIndicator";
import HttpUtils from "../../../utils/api/httpUtils";
import {Link} from "react-router-dom";
import NotificationUtils from "../../../utils/common/notificationUtils";
import QueryUtils from "../../../utils/common/queryUtils";
import React from "react";
import StateHolder from "../../common/state/stateHolder";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography/Typography";
import withGlobalState from "../../common/state";
import {withStyles} from "@material-ui/core/styles";
import * as PropTypes from "prop-types";

const styles = () => ({
    table: {
        width: "30%",
        marginTop: 25
    },
    tableCell: {
        borderBottom: "none"
    }
});

class Details extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            isDataAvailable: false,
            health: -1,
            dependencyGraphData: [],
            isLoading: false
        };
    }

    componentDidMount = () => {
        const {globalState} = this.props;

        this.update(
            true,
            QueryUtils.parseTime(globalState.get(StateHolder.GLOBAL_FILTER).startTime),
            QueryUtils.parseTime(globalState.get(StateHolder.GLOBAL_FILTER).endTime)
        );
    };

    update = (isUserAction, queryStartTime, queryEndTime) => {
        const {globalState, cell, component} = this.props;
        const self = this;

        const search = {
            queryStartTime: queryStartTime.valueOf(),
            queryEndTime: queryEndTime.valueOf(),
            destinationCell: cell,
            destinationComponent: component,
            includeIntraCell: true
        };

        if (isUserAction) {
            NotificationUtils.showLoadingOverlay("Loading Component Info", globalState);
            self.setState({
                isLoading: true
            });
        }
        HttpUtils.callObservabilityAPI(
            {
                url: `/http-requests/cells/components/metrics/${HttpUtils.generateQueryParamString(search)}`,
                method: "GET"
            },
            globalState
        ).then((data) => {
            const aggregatedData = data.map((datum) => ({
                isError: datum[1] === "5xx",
                count: datum[5]
            })).reduce((accumulator, currentValue) => {
                if (currentValue.isError) {
                    accumulator.errorsCount += currentValue.count;
                }
                accumulator.total += currentValue.count;
                return accumulator;
            }, {
                errorsCount: 0,
                total: 0
            });

            let health;
            if (aggregatedData.total > 0) {
                health = 1 - (aggregatedData.total === 0 ? aggregatedData.errorsCount / aggregatedData.total : 0);
            } else {
                health = -1;
            }
            self.setState({
                health: health,
                isDataAvailable: aggregatedData.total > 0
            });
            if (isUserAction) {
                NotificationUtils.hideLoadingOverlay(globalState);
                self.setState({
                    isLoading: false
                });
            }
        }).catch(() => {
            if (isUserAction) {
                NotificationUtils.hideLoadingOverlay(globalState);
                self.setState({
                    isLoading: false
                });
                NotificationUtils.showNotification(
                    "Failed to load component information",
                    NotificationUtils.Levels.ERROR,
                    globalState
                );
            }
        });
    };

    render() {
        const {classes, cell, component} = this.props;
        const {health, isLoading} = this.state;

        const view = (
            <Table className={classes.table}>
                <TableBody>
                    <TableRow>
                        <TableCell className={classes.tableCell}>
                            <Typography color="textSecondary">
                                Health
                            </Typography>
                        </TableCell>
                        <TableCell className={classes.tableCell}>
                            <HealthIndicator value={health}/>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className={classes.tableCell}>
                            <Typography color="textSecondary">
                                Cell
                            </Typography>
                        </TableCell>
                        <TableCell className={classes.tableCell}>
                            <Link to={`/cells/${cell}`}>{cell}</Link>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );

        return (
            <React.Fragment>
                {isLoading ? null : view}
                <ComponentDependencyView cell={cell} component={component}/>
            </React.Fragment>
        );
    }

}

Details.propTypes = {
    classes: PropTypes.object.isRequired,
    cell: PropTypes.string.isRequired,
    component: PropTypes.string.isRequired,
    globalState: PropTypes.instanceOf(StateHolder).isRequired
};

export default withStyles(styles)(withGlobalState(Details));

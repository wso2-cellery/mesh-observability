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

/* eslint max-lines: ["error", 600] */

import ArrowBack from "@material-ui/icons/ArrowBack";
import Button from "@material-ui/core/Button";
import CalendarToday from "@material-ui/icons/CalendarTodayOutlined";
import DateRangePicker from "./DateRangePicker";
import FormControl from "@material-ui/core/FormControl/FormControl";
import HttpUtils from "../../../utils/api/httpUtils";
import IconButton from "@material-ui/core/IconButton/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment/InputAdornment";
import MenuItem from "@material-ui/core/MenuItem/MenuItem";
import Popover from "@material-ui/core/Popover";
import QueryUtils from "../../../utils/common/queryUtils";
import React from "react";
import Refresh from "@material-ui/icons/Refresh";
import Select from "@material-ui/core/Select/Select";
import Toolbar from "@material-ui/core/Toolbar/Toolbar";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography/Typography";
import classNames from "classnames";
import {withRouter} from "react-router-dom";
import {withStyles} from "@material-ui/core";
import withGlobalState, {StateHolder} from "../state";
import * as PropTypes from "prop-types";

const styles = (theme) => ({
    container: {
        position: "sticky",
        top: 64,
        backgroundColor: "#fafafa",
        marginBottom: 42,
        zIndex: 999,
        minHeight: 70
    },
    title: {
        marginLeft: theme.spacing.unit,
        marginTop: theme.spacing.unit
    },
    subTitle: {
        marginLeft: theme.spacing.unit,
        marginTop: theme.spacing.unit * 1.5,
        color: "#666"
    },
    grow: {
        flexGrow: 1
    },
    dateRangeButton: {
        marginRight: theme.spacing.unit * 3,
        textTransform: "none",
        fontWeight: 500,
        border: "1px solid #e0e0e0"
    },
    startInputAdornment: {
        marginRight: theme.spacing.unit * 2,
        marginBottom: theme.spacing.unit * 2
    },
    selectInput: {
        border: "none",
        fontSize: 14
    },
    menuButton: {
        marginTop: theme.spacing.unit
    },
    dateRangeNicknameSelectedTime: {
        marginLeft: theme.spacing.unit,
        marginRight: theme.spacing.unit,
        fontWeight: 500
    },
    calendar: {
        marginLeft: 10
    },
    runtimeSelectFormControl: {
        marginRight: theme.spacing.unit * 3
    },
    namespaceSelectFormControl: {
        marginRight: theme.spacing.unit * 3
    },
    namespaceSelectWithTimeSelectorsSeparator: {
        paddingRight: theme.spacing.unit * 3,
        borderRight: "2px solid #ccc"
    }
});

class TopToolbar extends React.Component {

    constructor(props) {
        super(props);
        const {globalState} = this.props;

        const globalFilter = globalState.get(StateHolder.GLOBAL_FILTER);
        this.state = {
            runtime: globalFilter.runtime,
            namespace: globalFilter.namespace,
            startTime: globalFilter.startTime,
            endTime: globalFilter.endTime,
            dateRangeNickname: globalFilter.dateRangeNickname,
            refreshInterval: globalFilter.refreshInterval,
            dateRangeSelectorAnchorElement: undefined,
            isAutoRefreshEnabled: true
        };

        this.refreshIntervalID = null;
    }

    componentDidMount = () => {
        this.refreshManually();
    };

    componentDidUpdate = () => {
        this.startRefreshTask();
    };

    componentWillUnmount = () => {
        this.stopRefreshTask();
    };

    static getDerivedStateFromProps = (props, state) => ({
        ...state,
        isAutoRefreshEnabled: state.endTime.includes("now")
    });

    render = () => {
        const {classes, title, subTitle, hideNamespaceSelector, location, history, globalState, onUpdate} = this.props;
        const {
            runtime, namespace, startTime, endTime, dateRangeNickname, refreshInterval, dateRangeSelectorAnchorElement,
            isAutoRefreshEnabled
        } = this.state;

        const isDateRangeSelectorOpen = Boolean(dateRangeSelectorAnchorElement);
        const userReadPermissions = globalState.get(StateHolder.USER_PERMISSIONS)
            .filter((permission) => permission.actions.includes("API_GET"));
        const allowedRuntimes = Array.from(new Set(userReadPermissions.map((permission) => permission.runtime)));
        const allowedNamespaces = Array.from(new Set(userReadPermissions
            .filter((permission) => permission.runtime === runtime)
            .map((permission) => permission.namespace)));
        return (
            <div className={classes.container}>
                <Toolbar disableGutters={true}>
                    {
                        (location.state && location.state.hideBackButton) || history.length <= 1
                            || location.pathname === "/"
                            ? null
                            : (
                                <IconButton className={classes.menuButton} color="inherit" aria-label="Back"
                                    onClick={() => history.goBack()}>
                                    <ArrowBack/>
                                </IconButton>
                            )
                    }
                    <Typography variant="h5" color="inherit" className={classes.title}>
                        {title}
                    </Typography>
                    {
                        subTitle
                            ? (
                                <Typography variant="subtitle1" className={classes.subTitle}>
                                    {subTitle}
                                </Typography>
                            )
                            : null
                    }
                    <div className={classes.grow}/>
                    <FormControl className={classes.runtimeSelectFormControl}>
                        <Select value={runtime} inputProps={{name: "runtime", id: "runtime"}}
                            onChange={(event) => this.setRuntime(event.target.value)}
                            startAdornment={(
                                <InputAdornment className={classes.startInputAdornment}
                                    variant="filled" position="start">
                                    Runtime
                                </InputAdornment>
                            )}
                            className={classes.selectInput}>
                            {

                                allowedRuntimes.map((runtimeItem) => (
                                    <MenuItem key={runtimeItem} value={runtimeItem}>{runtimeItem}</MenuItem>
                                ))
                            }
                        </Select>
                    </FormControl>
                    {
                        hideNamespaceSelector
                            ? null
                            : (
                                <FormControl className={classNames({
                                    [classes.namespaceSelectFormControl]: true,
                                    [classes.namespaceSelectWithTimeSelectorsSeparator]: Boolean(onUpdate)
                                })}>
                                    <Select value={namespace} inputProps={{name: "namespace", id: "namespace"}}
                                        onChange={(event) => this.setNamespace(event.target.value)}
                                        startAdornment={(
                                            <InputAdornment className={classes.startInputAdornment}
                                                variant="filled" position="start">
                                                    Namespace
                                            </InputAdornment>
                                        )}
                                        className={classes.selectInput}>
                                        {
                                            allowedNamespaces
                                                .map((namespaceItem) => (
                                                    <MenuItem key={namespaceItem} value={namespaceItem}>
                                                        {namespaceItem}
                                                    </MenuItem>
                                                ))
                                        }
                                    </Select>
                                </FormControl>
                            )
                    }
                    {
                        onUpdate
                            ? (
                                <React.Fragment>
                                    <Button aria-owns={isDateRangeSelectorOpen ? "date-range-picker-popper" : undefined}
                                        className={classes.dateRangeButton} aria-haspopup="true" size="small"
                                        variant="text"
                                        onClick={(event) => this.openDateRangeSelector(event.currentTarget)}>
                                        {
                                            dateRangeNickname
                                                ? dateRangeNickname
                                                : (
                                                    <React.Fragment>
                                                        <Typography color={"textSecondary"}>From</Typography>
                                                        <Typography className={classes.dateRangeNicknameSelectedTime}>
                                                            {startTime}
                                                        </Typography>
                                                        <Typography color={"textSecondary"}>to</Typography>
                                                        <Typography className={classes.dateRangeNicknameSelectedTime}>
                                                            {endTime}
                                                        </Typography>
                                                    </React.Fragment>
                                                )
                                        }
                                        <CalendarToday color="action" className={classes.calendar}/>
                                    </Button>
                                    <Popover id="date-range-picker-popper"
                                        open={isDateRangeSelectorOpen}
                                        anchorEl={dateRangeSelectorAnchorElement}
                                        onClose={this.closeDateRangeSelector}
                                        anchorOrigin={{
                                            vertical: "bottom",
                                            horizontal: "right"
                                        }}
                                        transformOrigin={{
                                            vertical: "top",
                                            horizontal: "right"
                                        }}>
                                        <DateRangePicker startTime={startTime} endTime={endTime}
                                            dateRangeNickname={dateRangeNickname} onRangeChange={this.setTimePeriod}/>
                                    </Popover>
                                    {
                                        isAutoRefreshEnabled
                                            ? (
                                                <React.Fragment>
                                                    <FormControl>
                                                        <Select value={refreshInterval}
                                                            onChange={this.setRefreshInterval}
                                                            inputProps={{
                                                                name: "refresh-interval",
                                                                id: "refresh-interval"
                                                            }}
                                                            startAdornment={(
                                                                <InputAdornment className={classes.startInputAdornment}
                                                                    variant="filled" position="start">
                                                                        Refresh
                                                                </InputAdornment>
                                                            )}
                                                            className={classes.selectInput}>
                                                            <MenuItem value={-1}>Off</MenuItem>
                                                            <MenuItem value={5 * 1000}>Every 5 sec</MenuItem>
                                                            <MenuItem value={10 * 1000}>Every 10 sec</MenuItem>
                                                            <MenuItem value={15 * 1000}>Every 15 sec</MenuItem>
                                                            <MenuItem value={30 * 1000}>Every 30 sec</MenuItem>
                                                            <MenuItem value={60 * 1000}>Every 1 min</MenuItem>
                                                            <MenuItem value={5 * 60 * 1000}>Every 5 min</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                    <Tooltip title="Refresh Now">
                                                        <IconButton aria-label="Refresh" onClick={this.refreshManually}>
                                                            <Refresh />
                                                        </IconButton>
                                                    </Tooltip>
                                                </React.Fragment>
                                            )
                                            : null
                                    }
                                </React.Fragment>
                            )
                            : null
                    }
                </Toolbar>
            </div>
        );
    };

    /**
     * Open the date range selector with the provided element as the anchor.
     *
     * @param {HTMLElement} element The element which should act as the anchor of the date range popover
     */
    openDateRangeSelector = (element) => {
        this.setState({
            dateRangeSelectorAnchorElement: element
        });
    };

    /**
     * Close the date range selector currently open.
     */
    closeDateRangeSelector = () => {
        this.setState({
            dateRangeSelectorAnchorElement: undefined
        });
    };

    /**
     * Set the runtime for which all the dashboard items will be limited to.
     *
     * @param {string} runtime The runtime to limit the dashboard
     */
    setRuntime = (runtime) => {
        const {globalState, location, match, history} = this.props;

        globalState.set(StateHolder.GLOBAL_FILTER, {
            ...globalState.get(StateHolder.GLOBAL_FILTER),
            runtime: runtime
        });

        // Removing Query Params provided for overriding time range
        const queryParamsString = HttpUtils.generateQueryParamString({
            ...HttpUtils.parseQueryParams(location.search),
            globalFilterRuntime: undefined
        });
        history.replace(match.url + queryParamsString, {
            ...location.state
        });

        this.stopRefreshTask(); // Stop any existing refresh tasks (Will be restarted when the component is updated)
        this.refresh(true);
        this.setState({
            runtime: runtime
        });
    };

    /**
     * Set the namespace for which all the dashboard items will be limited to.
     *
     * @param {string} namespace The namespace to limit the dashboard
     */
    setNamespace = (namespace) => {
        const {globalState, location, match, history} = this.props;

        globalState.set(StateHolder.GLOBAL_FILTER, {
            ...globalState.get(StateHolder.GLOBAL_FILTER),
            namespace: namespace
        });

        // Removing Query Params provided for overriding time range
        const queryParamsString = HttpUtils.generateQueryParamString({
            ...HttpUtils.parseQueryParams(location.search),
            globalFilterNamespace: undefined
        });
        history.replace(match.url + queryParamsString, {
            ...location.state
        });

        this.stopRefreshTask(); // Stop any existing refresh tasks (Will be restarted when the component is updated)
        this.refresh(true);
        this.setState({
            namespace: namespace
        });
    };

    /**
     * Set the time period which should be considered for fetching data for the application.
     *
     * @param {string} startTime The new start time to be set
     * @param {string} endTime The new end time to be set
     * @param {string} dateRangeNickname The new date range nickname to be set
     */
    setTimePeriod = (startTime, endTime, dateRangeNickname) => {
        const {globalState, location, match, history} = this.props;

        globalState.set(StateHolder.GLOBAL_FILTER, {
            ...globalState.get(StateHolder.GLOBAL_FILTER),
            startTime: startTime,
            endTime: endTime,
            dateRangeNickname: dateRangeNickname
        });

        // Removing Query Params provided for overriding time range
        const queryParamsString = HttpUtils.generateQueryParamString({
            ...HttpUtils.parseQueryParams(location.search),
            globalFilterStartTime: undefined,
            globalFilterEndTime: undefined
        });
        history.replace(match.url + queryParamsString, {
            ...location.state
        });

        this.stopRefreshTask(); // Stop any existing refresh tasks (Will be restarted when the component is updated)
        this.refresh(true, startTime, endTime);
        this.setState({
            startTime: startTime,
            endTime: endTime,
            dateRangeNickname: dateRangeNickname
        });
        this.closeDateRangeSelector();
    };

    /**
     * Set the refresh interval to be used by the application.
     *
     * @param {Event} event The change event of the select input for the refresh interval
     */
    setRefreshInterval = (event) => {
        const {globalState} = this.props;
        const newRefreshInterval = event.target.value;

        globalState.set(StateHolder.GLOBAL_FILTER, {
            ...globalState.get(StateHolder.GLOBAL_FILTER),
            refreshInterval: newRefreshInterval
        });

        this.stopRefreshTask(); // Stop any existing refresh tasks (Will be restarted when the component is updated)
        this.setState({
            refreshInterval: newRefreshInterval
        });
    };

    /**
     * Call the update method and refresh the relevant parts of the page.
     * This will also reset the refresh task.
     */
    refreshManually = () => {
        this.stopRefreshTask();
        this.refresh(true);
        this.startRefreshTask();
    };

    /**
     * Start the refresh task which periodically calls the update method.
     */
    startRefreshTask = () => {
        const {refreshInterval, isAutoRefreshEnabled} = this.state;
        const self = this;

        this.stopRefreshTask(); // Stop any existing refresh tasks
        if (isAutoRefreshEnabled) {
            if (refreshInterval && refreshInterval > 0) {
                this.refreshIntervalID = setInterval(() => self.refresh(false), refreshInterval);
            }
        }
    };

    /**
     * Stop the refresh task which was started by #startRefreshTask().
     */
    stopRefreshTask = () => {
        if (this.refreshIntervalID) {
            clearInterval(this.refreshIntervalID);
            this.refreshIntervalID = null;
        }
    };

    /**
     * Refresh the components by calling the on Update.
     *
     * @param {boolean} isUserAction True if the refresh was initiated by user
     * @param {string} startTimeOverride Override for the start time in the state
     * @param {string} endTimeOverride Override for the end time in the state
     */
    refresh = (isUserAction, startTimeOverride = undefined, endTimeOverride = undefined) => {
        const {onUpdate} = this.props;
        const {startTime, endTime} = this.state;

        if (onUpdate) {
            onUpdate(
                isUserAction,
                QueryUtils.parseTime(startTimeOverride ? startTimeOverride : startTime),
                QueryUtils.parseTime(endTimeOverride ? endTimeOverride : endTime)
            );
        }
    };

}

TopToolbar.propTypes = {
    onUpdate: PropTypes.func,
    title: PropTypes.string.isRequired,
    subTitle: PropTypes.string,
    hideNamespaceSelector: PropTypes.bool,
    classes: PropTypes.object.isRequired,
    globalState: PropTypes.instanceOf(StateHolder).isRequired,
    history: PropTypes.shape({
        goBack: PropTypes.func.isRequired
    }),
    location: PropTypes.shape({
        state: PropTypes.any
    }).isRequired,
    match: PropTypes.shape({
        url: PropTypes.string.isRequired
    }).isRequired
};

export default withStyles(styles, {withTheme: true})(withRouter(withGlobalState(TopToolbar)));

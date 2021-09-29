import React, { useEffect, ReactNode, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "styled-components";
import Canvas from "./Canvas";
import {
  getIsFetchingPage,
  getCurrentPageId,
  getCanvasWidgetDsl,
  getCurrentPageName,
  getViewModePageList,
  previewModeSelector,
  getPanningEnabled,
  getIsPanning,
} from "selectors/editorSelectors";
import Centered from "components/designSystems/appsmith/CenteredWrapper";
import { Spinner } from "@blueprintjs/core";
import AnalyticsUtil from "utils/AnalyticsUtil";
import * as log from "loglevel";
import { getCanvasClassName } from "utils/generators";
import { flashElementsById } from "utils/helpers";
import { useParams } from "react-router";
import PerformanceTracker, {
  PerformanceTransactionName,
} from "utils/PerformanceTracker";
import { getCurrentApplication } from "selectors/applicationSelectors";
import { useDynamicAppLayout } from "utils/hooks/useDynamicAppLayout";
import Debugger from "components/editorComponents/Debugger";
import { closePropertyPane, closeTableFilterPane } from "actions/widgetActions";
import { useWidgetSelection } from "utils/hooks/useWidgetSelection";
import { setCanvasSelectionFromEditor } from "actions/canvasSelectionActions";
import CrudInfoModal from "./GeneratePage/components/CrudInfoModal";
import EditorContextProvider from "components/editorComponents/EditorContextProvider";
import { useAllowEditorDragToSelect } from "utils/hooks/useAllowEditorDragToSelect";
import OnboardingTasks from "./FirstTimeUserOnboarding/Tasks";
import {
  getIsOnboardingTasksView,
  getIsOnboardingWidgetSelection,
} from "selectors/entitiesSelector";
import { getIsFirstTimeUserOnboardingEnabled } from "selectors/onboardingSelectors";
import PageTabsContainer from "pages/AppViewer/viewer/PageTabsContainer";
import classNames from "classnames";
import usePanZoom from "utils/hooks/useZoom";
import { updateIsPanning, updateZoomLevel } from "actions/editorActions";
import { transform } from "utils/hooks/useZoom/utils";

const CanvasContainer = styled.section`
  height: 100%;
  width: 100%;
  position: relative;
  overflow-x: auto;
  overflow-y: auto;
  padding-top: 1px;
  &:before {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
  }
`;

/* eslint-disable react/display-name */
function WidgetsEditor() {
  const { deselectAll, focusWidget, selectWidget } = useWidgetSelection();
  const params = useParams<{ applicationId: string; pageId: string }>();
  const dispatch = useDispatch();
  const isPanning = useSelector(getIsPanning);
  const widgets = useSelector(getCanvasWidgetDsl);
  const isFetchingPage = useSelector(getIsFetchingPage);
  const currentPageId = useSelector(getCurrentPageId);
  const currentPageName = useSelector(getCurrentPageName);
  const pages = useSelector(getViewModePageList);
  const currentApp = useSelector(getCurrentApplication);
  const isPreviewMode = useSelector(previewModeSelector);
  const isPanningEnabled = useSelector(getPanningEnabled);
  const currentApplicationDetails = useSelector(getCurrentApplication);

  const showOnboardingTasks = useSelector(getIsOnboardingTasksView);
  const enableFirstTimeUserOnboarding = useSelector(
    getIsFirstTimeUserOnboardingEnabled,
  );
  const isOnboardingWidgetSelection = useSelector(
    getIsOnboardingWidgetSelection,
  );
  useDynamicAppLayout();
  useEffect(() => {
    PerformanceTracker.stopTracking(PerformanceTransactionName.CLOSE_SIDE_PANE);
  });

  // log page load
  useEffect(() => {
    if (currentPageName !== undefined && currentPageId !== undefined) {
      AnalyticsUtil.logEvent("PAGE_LOAD", {
        pageName: currentPageName,
        pageId: currentPageId,
        appName: currentApp?.name,
        mode: "EDIT",
      });
    }
  }, [currentPageName, currentPageId]);

  // navigate to widget
  useEffect(() => {
    if (!isFetchingPage && window.location.hash.length > 0) {
      const widgetIdFromURLHash = window.location.hash.substr(1);
      flashElementsById(widgetIdFromURLHash);
      if (document.getElementById(widgetIdFromURLHash))
        selectWidget(widgetIdFromURLHash);
    }
  }, [isFetchingPage, selectWidget]);

  const handleWrapperClick = useCallback(() => {
    focusWidget && focusWidget();
    deselectAll && deselectAll();
    dispatch(closePropertyPane());
    dispatch(closeTableFilterPane());
    dispatch(setCanvasSelectionFromEditor(false));
  }, [focusWidget, deselectAll]);

  const pageLoading = (
    <Centered>
      <Spinner />
    </Centered>
  );
  let node: ReactNode;
  if (isFetchingPage) {
    node = pageLoading;
  }

  if (!isFetchingPage && widgets) {
    node = <Canvas dsl={widgets} pageId={params.pageId} />;
  }
  const allowDragToSelect = useAllowEditorDragToSelect();

  const onDragStart = useCallback(
    (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      if (allowDragToSelect) {
        const startPoints = {
          x: e.clientX,
          y: e.clientY,
        };
        dispatch(setCanvasSelectionFromEditor(true, startPoints));
      }
    },
    [allowDragToSelect],
  );

  log.debug("Canvas rendered");

  /**
   * dispatches an action that updates zoom level
   */
  const onZoom = useCallback(
    (transform: transform) => {
      dispatch(updateZoomLevel(transform.zoom));
    },
    [dispatch],
  );

  /**
   * dispatches an action that updates isPanning flag to true
   */
  const onPanStart = useCallback(() => {
    dispatch(updateIsPanning(true));
  }, [dispatch, updateIsPanning]);

  /**
   * dispatches an action that updates isPanning flag to false
   */
  const onPanEnd = useCallback(() => {
    dispatch(updateIsPanning(false));
  }, [dispatch, updateIsPanning]);

  const {
    panZoomHandlers,
    setContainer,
    setPan,
    setZoom,
    transform,
  } = usePanZoom({
    onZoom,
    onPanStart,
    onPanEnd,
    enablePan: isPanningEnabled,
    maxZoom: 1,
  });

  /**
   * resetting panning and zoom when preview mode is on
   */
  useEffect(() => {
    if (isPreviewMode === true) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isPreviewMode]);

  PerformanceTracker.stopTracking();
  return (
    <EditorContextProvider>
      {enableFirstTimeUserOnboarding &&
      showOnboardingTasks &&
      !isOnboardingWidgetSelection ? (
        <OnboardingTasks />
      ) : (
        <div
          className={classNames({
            "relative flex flex-col items-stretch justify-start flex-1 overflow-hidden": true,
            "cursor-grab": isPanningEnabled && isPanning === false,
            "cursor-grabbing": isPanning === true,
          })}
          data-testid="widgets-editor"
          draggable
          onClick={handleWrapperClick}
          onDragStart={onDragStart}
          ref={(el) => setContainer(el)}
          {...panZoomHandlers}
        >
          <div
            className={classNames({
              "transform  bg-gray-50": true,
              "translate-y-0 ease-in transition": isPreviewMode,
              "-translate-y-full duration-0": !isPreviewMode,
            })}
          >
            <PageTabsContainer
              currentApplicationDetails={currentApplicationDetails}
              pages={pages}
            />
          </div>
          <CanvasContainer
            className={getCanvasClassName()}
            key={currentPageId}
            style={{ transform }}
          >
            {node}
          </CanvasContainer>
          <Debugger />
          <CrudInfoModal />
        </div>
      )}
    </EditorContextProvider>
  );
}

export default WidgetsEditor;

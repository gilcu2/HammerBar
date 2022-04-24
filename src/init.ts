import {
  ScreenInfoType,
  WindowInfoType,
  getScreenInfo,
  getWindowInfo,
} from './hammerspoonUtils';

import Taskbar from './components/Taskbar';

interface AppNameAndWindowTitleType {
  appName: string;
  windowTitle?: string;
  displayAppName?: string;
  displayWindowTitle?: string;
}

interface ConfigType {
  fontSize: number;
  defaultColors: {
    taskbar: hs.ColorType;
    icons: hs.ColorType;
  };
  userAppNamesAndWindowTitles?: Array<AppNameAndWindowTitleType>;
}

const config:ConfigType = {
  fontSize: 13,
  defaultColors: {
    taskbar: { red: 220/255, green: 220/255, blue: 220/255 },
    icons:   { red: 132/255, green: 132/255, blue: 130/255 },
  },
};

interface CanvasesOneScreenType {
  NEWtaskbar: Taskbar;
}

interface StateType {
  allowAllWindows: boolean;
  canvasesByScreenId: Map<number, CanvasesOneScreenType>;
  taskbarsAreVisible: boolean;
  windowFilter: hs.WindowFilter | undefined;
}

const state:StateType = {
  allowAllWindows: false,
  canvasesByScreenId: new Map<number, CanvasesOneScreenType>(),
  taskbarsAreVisible: true,
  windowFilter: undefined,
};

//-----------------------------------------------------------------------------

function getAppNameAndWindowTitle(
  window: WindowInfoType
): {appNameToDisplay: string, windowTitleToDisplay: string} {
  const userConfig = config.userAppNamesAndWindowTitles ? config.userAppNamesAndWindowTitles : [];

  let returnValue = {
    appNameToDisplay: window.appName,
    windowTitleToDisplay: window.windowTitle
  }

  userConfig.forEach((configObject) => {
    if (
      configObject.appName === window.appName &&
      (configObject.windowTitle == window.windowTitle || !configObject.windowTitle)
    ) {
      if (configObject.displayAppName) {
        returnValue.appNameToDisplay = configObject.displayAppName;
      }

      if (configObject.displayWindowTitle) {
        returnValue.windowTitleToDisplay = configObject.displayWindowTitle;
      }
    }
  });

  return returnValue
}

function onTaskbarClick(
  this: void,
  _canvas: hs.CanvasType,
  _message: string,
  id: string | number
) {
  const idAsNumber = (typeof id === 'number') ? id : parseInt(id);

  // We can't use hs.window.get() because it causes a gigantic delay if other
  // tools like RectangleWM are running
  const allWindows = state.windowFilter?.getWindows() || [];
  const hsWindow = allWindows.filter((window) => window.id() === idAsNumber)[0];

  // We have to check for null because it may have been closed after the most
  // recent taskbar update
  if (!hsWindow) {
    return;
  }

  const keyboardModifiers = hs.eventtap.checkKeyboardModifiers();

  if (keyboardModifiers.shift) {
    // User just wants to dump the window info without toggling window visibility
    printWindowInfo(hsWindow);
    return;
  }

  if (hsWindow.isMinimized()) {
    // Most apps require just focus(), but some like LibreOffice also require raise()
    hsWindow.raise();
    hsWindow.focus();
  } else {
    if (keyboardModifiers.cmd || keyboardModifiers.ctrl) {
      // Just focus() the window because user just wants to make it visible
      // instead of minimizing it
      hsWindow.focus();
    } else {
      hsWindow.minimize();
    }
  }
}

function onToggleButtonClick(this: void) {
  toggleTaskbarVisibility();
  updateAllTaskbars();
}

function printWindowInfo(hsWindow: hs.WindowType) {
  const window = getWindowInfo(hsWindow);
  print('');
  print('Window info:');
  print(`    appName    : ${window.appName}`);
  print(`    bundleId   : ${window.bundleId}`);
  print(`    id         : ${window.id}`);
  print(`    isMinimized: ${window.isMinimized}`);
  print(`    isStandard : ${window.isStandard}`);
  print(`    role       : ${window.role}`);
  print(`    screenId   : ${window.screenId}`);
  print(`    windowTitle: ${window.windowTitle}`);
  print('');
}

function subscribeWindowFilterToEvents() {
  state.windowFilter?.subscribe(
    [
      hs.window.filter.windowCreated,
      hs.window.filter.windowDestroyed,

      // This is the Mac "hide" functionality
      hs.window.filter.windowHidden,
      hs.window.filter.windowMinimized,

      // Need this to handle when window moved to another screen
      hs.window.filter.windowMoved,

      // For keeping text in taskbar up to date
      hs.window.filter.windowTitleChanged,

      hs.window.filter.windowUnhidden,

      // This only fires if window was *Hidden* then unminimized
      hs.window.filter.windowUnminimized,

      // This is the only way to trigger when a window is unminimized (but
      // wasn't "hidden" prior to that)
      hs.window.filter.windowVisible,
    ],
    updateAllTaskbars,
  );
}

function toggleTaskbarVisibility() {
  state.taskbarsAreVisible = !state.taskbarsAreVisible;
}

function updateAllTaskbars() {
  const allWindows:WindowInfoType[] = [];
  const allScreens:ScreenInfoType[] = [];

  state.windowFilter?.getWindows().forEach((hammerspoonWindow) => {
    const windowInfo = getWindowInfo(hammerspoonWindow);
    allWindows.push(windowInfo);
  });

  //----------------------------------------------------------------------------
  // Update things that may have changed since our last call:
  //  - screens may have been added or removed
  //----------------------------------------------------------------------------
  hs.screen.allScreens().forEach((hammerspoonScreen) => {
    const screenInfo = getScreenInfo(hammerspoonScreen);
    allScreens.push(screenInfo);
  });

  updateCanvasesByScreenId(allScreens);

  allScreens.forEach((screen) => {
    const windowsThisScreen = allWindows.filter(
      (window) => window.screenId === screen.id
    );
    const canvases = state.canvasesByScreenId.get(screen.id);
    if (!canvases) {
      print(`Hammerbar: No canvas for screen ${screen.id}`);
    } else {
      canvases.NEWtaskbar.update(state.taskbarsAreVisible, windowsThisScreen);
    }
  });
}

function updateCanvasesByScreenId(allScreens: Array<ScreenInfoType>) {

  // Ensure each screen has a corresponding canvas
  allScreens.forEach((screen) => {
    if (!state.canvasesByScreenId.get(screen.id)) {
      print(`Adding canvases for screen: ${screen.id}`);


      const NEWtaskbar = new Taskbar({
        fontSize: config.fontSize,
        screenInfo: screen,
        backgroundColor: config.defaultColors.taskbar,
        onToggleButtonClick: onToggleButtonClick,
        onWindowButtonClick: onTaskbarClick,
      });

      state.canvasesByScreenId.set(
        screen.id,
        {
          NEWtaskbar: NEWtaskbar,
        }
      );
    }
  });

  // Remove canvases for screens that no longer exist
  state.canvasesByScreenId.forEach((_canvas, screenId) => {
    const foundScreens = allScreens.filter((screen) => screen.id === screenId);
    if (foundScreens.length === 0) {
      print(`Removing canvases for screen: ${screenId}`);
      state.canvasesByScreenId.delete(screenId);
    }
  });
}

function windowFilterCallback(this: void, hsWindow: hs.WindowType) {
  if (state.allowAllWindows) {
    return true;
  }

  // Based on the HammerSpoon docs, you'd think we could just filter out
  // windows that are not "standard". However that also filters out some
  // windows that we want in the taskbar. For instance the following are all
  // classified as not "standard" (but only when they're minimized):
  //  - gitk
  //  - Safari
  //  - DBeaver
  //
  // It looks like the windows we want in the taskbar all have a "role" of
  // "AXWindow".
  //
  // Ironically Hammerspoon has its own weirdness to account for:
  //  - the Console is "standard" unless it's minimized -- then it's not "standard"
  //  - there are other windows associated with Hammerspoon (that we don't care
  //    about), all of which have a role of "AXWindow" but they are not "standard"
  const window = getWindowInfo(hsWindow);
  return (
    (window.appName === 'Hammerspoon' && window.windowTitle === 'Hammerspoon Console') ||
    (window.appName !== 'Hammerspoon' && window.role === 'AXWindow')
  );
}

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

// Use this function to allow *all* windows reported by HammerSpoon in the
// taskbar. This will be useful if a window isn't showing up normally. So with
// this enabled, user can shift-click on the window button in question and get
// all the hammerspoon info about it
export function allowAllWindows() {
  state.allowAllWindows = true;
}

export function setAppNamesAndWindowTitles(appNamesAndWindowTitles: Array<AppNameAndWindowTitleType>) {
  config.userAppNamesAndWindowTitles = appNamesAndWindowTitles;
}

export function start() {
  state.windowFilter = hs.window.filter.new(windowFilterCallback);
  subscribeWindowFilterToEvents();
  updateAllTaskbars();
}

export function stop() {
  state.windowFilter?.unsubscribeAll();
}


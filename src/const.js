exports.MESSAGE_SHUTDOWN_SERVER = "shutdown_server";
exports.MESSAGE_TYPE_EVENT = "event";
exports.MESSAGE_TYPE_TEXT = "text";
exports.MESSAGE_TYPE_STREAM_INFO = "stream_info";

exports.EVENT_TYPE = {
  KEYCODE: 0,
  TEXT: 1,
  MOUSE: 2,
  SCROLL: 3,
  COMMAND: 4
};

exports.MOTION_EVENT = {
  ACTION_DOWN: 0,
  ACTION_UP: 1,
  ACTION_MOVE: 2,
  /**
   * Button constant: Primary button (left mouse button).
   */
  BUTTON_PRIMARY: 1 << 0,

  /**
   * Button constant: Secondary button (right mouse button).
   */
  BUTTON_SECONDARY: 1 << 1,

  /**
   * Button constant: Tertiary button (middle mouse button).
   */
  BUTTON_TERTIARY: 1 << 2
};

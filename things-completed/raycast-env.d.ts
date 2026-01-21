/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `show-completed-yesterday` command */
  export type ShowCompletedYesterday = ExtensionPreferences & {}
  /** Preferences accessible in the `show-completed-today` command */
  export type ShowCompletedToday = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `show-completed-yesterday` command */
  export type ShowCompletedYesterday = {}
  /** Arguments passed to the `show-completed-today` command */
  export type ShowCompletedToday = {}
}


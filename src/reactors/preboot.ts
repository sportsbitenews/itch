import Context from "../context";
import { Watcher } from "./watcher";
import * as actions from "../actions";

import store from "../store/metal-store";
import db from "../db";

import { cleanOldLogs } from "./preboot/clean-old-logs";
import * as xdgMime from "./preboot/xdg-mime";
import * as visualElements from "./preboot/visual-elements";

import rootLogger from "../logger";
const logger = rootLogger.child({ name: "preboot" });

import { ProxySource } from "../types";

import { NET_PARTITION_NAME } from "../constants/net";
import { applyProxySettings } from "../reactors/proxy";

import { elapsed } from "../format/datetime";

let testProxy = false;
let proxyTested = false;

export default function(watcher: Watcher) {
  const ctx = new Context(store, db);
  watcher.on(actions.preboot, async (store, action) => {
    let t1 = Date.now();
    try {
      try {
        await cleanOldLogs();
      } catch (e) {
        logger.error(`Could not clean old logs: ${e.stack || e.message || e}`);
      }

      try {
        await xdgMime.registerIfNeeded(ctx, { logger: rootLogger });
      } catch (e) {
        logger.error(`Could not run xdg-mime: ${e.stack || e.message || e}`);
      }

      try {
        await visualElements.createIfNeeded(ctx);
      } catch (e) {
        logger.error(
          `Could not run visualElements: ${e.stack || e.message || e}`
        );
      }

      try {
        const { app } = require("electron");
        app.on(
          "certificate-error",
          (ev, webContents, url, error, certificate, callback) => {
            // do not trust
            callback(false);

            logger.error(
              `Certificate error: ${error} issued by ${certificate.issuerName} for ${certificate.subjectName}`
            );

            store.dispatch(
              actions.openModal({
                title: `Certificate error: ${error}`,
                message:
                  `There was an error with the certificate for ` +
                  `\`${certificate.subjectName}\` issued by \`${certificate.issuerName}\`.\n\n` +
                  `Please check your proxy configuration and try again.`,
                detail: `If you ignore this error, the rest of the app might not work correctly.`,
                buttons: [
                  {
                    label: "Ignore and continue",
                    action: actions.closeModal({}),
                    className: "secondary",
                  },
                  {
                    label: ["menu.file.quit"],
                    action: actions.quit({}),
                  },
                ],
              })
            );
          }
        );
        logger.debug(`Set up certificate error handler`);
      } catch (e) {
        logger.error(
          `Could not set up certificate error handler: ${e.stack ||
            e.message ||
            e}`
        );
      }

      try {
        const { session } = require("electron");
        const netSession = session.fromPartition(NET_PARTITION_NAME, {
          cache: false,
        });

        const envSettings: string =
          process.env.https_proxy ||
          process.env.HTTPS_PROXY ||
          process.env.http_proxy ||
          process.env.HTTP_PROXY;

        let proxySettings = {
          proxy: null as string,
          source: "os" as ProxySource,
        };

        if (envSettings) {
          logger.info(`Got proxy settings from environment: ${envSettings}`);
          proxySettings = {
            proxy: envSettings,
            source: "env",
          };
          testProxy = true;
          store.dispatch(actions.proxySettingsDetected(proxySettings));
          await applyProxySettings(netSession, proxySettings);
        }
      } catch (e) {
        logger.warn(
          `Could not detect proxy settings: ${e ? e.message : "unknown error"}`
        );
      }
    } catch (e) {
      throw e;
    } finally {
      const t2 = Date.now();
      logger.info(`preboot ran in ${elapsed(t1, t2)}`);
    }

    store.dispatch(actions.boot({}));
  });

  watcher.on(actions.attemptLogin, async (store, action) => {
    if (!testProxy) {
      return;
    }

    if (proxyTested) {
      return;
    }
    proxyTested = true;

    const { BrowserWindow } = require("electron");
    const win = new BrowserWindow({ show: false });

    win.webContents.on("did-finish-load", () => {
      logger.info(`Test page loaded with proxy successfully!`);
    });
    win.webContents.on("did-fail-load", () => {
      logger.warn(`Test page failed to load with proxy!`);
    });

    logger.info(
      `Testing proxy by loading a page in a hidden browser window...`
    );
    win.loadURL("https://itch.io/country");

    setTimeout(() => {
      win.close();
    }, 15 * 1000);
  });
}

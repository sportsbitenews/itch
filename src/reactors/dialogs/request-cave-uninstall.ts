import { Watcher } from "../watcher";
import * as actions from "../../actions";

import lazyGetGame from "../lazy-get-game";

import { DB } from "../../db";
import Context from "../../context";

export default function(watcher: Watcher, db: DB) {
  watcher.on(actions.requestCaveUninstall, async (store, action) => {
    const { caveId } = action.payload;

    const cave = db.caves.findOneById(caveId);
    if (!cave) {
      return;
    }

    const ctx = new Context(store, db);
    const game = await lazyGetGame(ctx, cave.gameId);

    // FIXME: i18n - plus, that's generally bad
    const title = game ? game.title : "this";

    store.dispatch(
      actions.openModal({
        title: "",
        message: ["prompt.uninstall.message", { title }],
        buttons: [
          {
            label: ["prompt.uninstall.uninstall"],
            action: actions.queueCaveUninstall({ caveId }),
            icon: "uninstall",
          },
          {
            label: ["prompt.uninstall.reinstall"],
            action: actions.queueCaveReinstall({ caveId }),
            icon: "repeat",
          },
          "cancel",
        ],
      })
    );
  });
}

import { Fetcher } from "./types";

import normalize from "../api/normalize";
import { collection, arrayOf } from "../api/schemas";

import { fromJSONField } from "../db/json-field";

import { indexBy } from "underscore";
import { GAMES_SHOWN_PER_COLLECTION } from "./constants";

const emptyObj = {};

export default class CollectionsFetcher extends Fetcher {
  constructor() {
    super();
  }

  async work(): Promise<void> {
    await this.pushLocal();

    if (this.warrantsRemote(this.reason)) {
      await this.remote();
      await this.pushLocal();
    }
  }

  async pushLocal() {
    const { db } = this.ctx;
    const meId = this.ensureCredentials().me.id;

    const profile = db.profiles.findOneById(meId);
    if (!profile) {
      return;
    }

    const localCollectionIds = fromJSONField<number[]>(
      profile.myCollectionIds,
      []
    );
    const localCollections = db.collections.all(k =>
      k.where("id in ?", localCollectionIds)
    );

    let allGameIds: number[] = [];
    for (const c of localCollections) {
      const collectionGameIds = fromJSONField<number[]>(c.gameIds, []);
      allGameIds = [
        ...allGameIds,
        ...collectionGameIds.slice(0, GAMES_SHOWN_PER_COLLECTION),
      ];
    }

    let localGames = [];
    if (allGameIds.length > 0) {
      localGames = db.games.all(k => k.where("id in ?", allGameIds));
    }
    this.push({
      collections: {
        set: indexBy(localCollections, "id"),
        ids: localCollectionIds,
      },
      games: {
        set: indexBy(localGames, "id"),
        ids: [],
      },
    });
  }

  async remote() {
    const { db } = this.ctx;
    const normalized = await this.withApi(async api => {
      return normalize(await api.myCollections(), {
        collections: arrayOf(collection),
      });
    });

    const collections = normalized.entities.collections || emptyObj;
    const meId = this.ensureCredentials().me.id;
    for (const id of Object.keys(collections)) {
      collections[id].userId = meId;
    }

    db.saveMany(normalized.entities);

    const { collectionIds } = normalized.result;
    db.saveOne("profiles", meId, { myCollectionIds: collectionIds });
  }
}

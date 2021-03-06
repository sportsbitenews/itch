import * as React from "react";
import * as classNames from "classnames";
import { IGame } from "../../db/models/game";
import { ICaveSummary } from "../../db/models/cave";
import { InjectedIntl } from "react-intl";

import Hoverable from "../basics/hover-hoc";
import Filler from "../basics/filler";
import Cover from "../basics/cover";
import IconButton from "../basics/icon-button";

const HoverCover = Hoverable(Cover);

import MainAction from "../game-actions/main-action";
import getGameStatus, { IGameStatus } from "../../helpers/get-game-status";
import { IRootState } from "../../types/index";
import { connect } from "../connect";

import * as actions from "../../actions";
import { dispatcher } from "../../constants/action-types";
import isCavePristine from "../../helpers/is-cave-pristine";

class Cell extends React.PureComponent<IProps & IDerivedProps> {
  render() {
    const { game, cave, status } = this.props;

    const {
      column,
      columnWidth,
      row,
      rowHeight,
      interiorMargin,
      globalMargin,
    } = this.props;
    const { stillCoverUrl, coverUrl } = game;

    // round numbers to avoid blurry text
    const translateX = Math.round(column * (columnWidth + interiorMargin));
    const translateY = Math.round(
      globalMargin + row * (rowHeight + interiorMargin)
    );
    const style = {
      transform: `translate(${translateX}px, ${translateY}px)`,
    };

    const pristine = cave && isCavePristine(cave);
    const className = classNames("grid--cell", { pristine });

    return (
      <div className={className} style={style} data-game-id={game.id}>
        <HoverCover
          className="cell--cover"
          showGifMarker={true}
          coverUrl={coverUrl}
          ribbon={pristine}
          stillCoverUrl={stillCoverUrl}
          gameId={game.id}
        />
        <div className="cell--undercover">
          <div className="cell--title">
            {game.title}
          </div>
          <div className="cell--actions">
            <MainAction
              className="cell-main-action"
              game={game}
              status={status}
            />
            <Filler />
            <IconButton
              big
              className="cell-main-action"
              icon="more_vert"
              onClick={this.onMoreClick}
              emphasized
            />
          </div>
        </div>
      </div>
    );
  }

  onMoreClick = (ev: React.MouseEvent<any>) => {
    const { game, openGameContextMenu } = this.props;
    openGameContextMenu({ game, pageX: ev.pageX, pageY: ev.pageY });
  };
}

interface IProps {
  game: IGame;
  cave: ICaveSummary;
  intl: InjectedIntl;

  column: number;
  columnWidth: number;

  row: number;
  rowHeight: number;

  interiorMargin: number;
  globalMargin: number;
}

interface IDerivedProps {
  status: IGameStatus;

  openGameContextMenu: typeof actions.openGameContextMenu;
}

export default connect<IProps>(Cell, {
  state: (rs: IRootState, props: IProps) => ({
    status: getGameStatus(rs, props.game),
  }),
  dispatch: dispatch => ({
    openGameContextMenu: dispatcher(dispatch, actions.openGameContextMenu),
  }),
});

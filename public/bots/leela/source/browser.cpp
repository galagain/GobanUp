// GobanUp browser entry points for Leela Zero v0.17 (GPL-3.0-or-later).
#include "GameState.h"
#include "GTP.h"
#include "Network.h"
#include "Random.h"
#include "UCTSearch.h"
#include "Utils.h"
#include "Zobrist.h"

static std::unique_ptr<Network> network;

extern "C" void load_engine() {
    GTP::setup_default_parameters();
    cfg_quiet = true;
    cfg_num_threads = 1;
    cfg_allow_pondering = false;
    cfg_max_visits = 6400;
    cfg_resignpct = 10;
    cfg_lagbuffer_cs = 0;
    Random hash_rng(5489);
    Zobrist::init_zobrist(hash_rng);
    Random::get_Rng().seedrandom(cfg_rng_seed);
    Utils::create_z_table();
    network = std::make_unique<Network>();
    network->initialize(cfg_max_visits, "/elf");
}

extern "C" int choose(const int* moves, int count) {
    GameState game;
    game.init_game(BOARD_SIZE, 7.5f);
    for (int i = 0; i < count; ++i) {
        const int p = moves[i];
        if (p < -1 || p >= NUM_INTERSECTIONS) return -3;
        game.play_move(p == -1 ? FastBoard::PASS :
                       game.board.get_vertex(p % BOARD_SIZE, BOARD_SIZE - 1 - p / BOARD_SIZE));
    }
    game.set_timecontrol(0, 200, 1, 0);
    UCTSearch search(game, *network);
    const int reply = search.think(game.board.get_to_move());
    if (reply == FastBoard::PASS || reply == FastBoard::RESIGN) return reply;
    const auto xy = game.board.get_xy(reply);
    return (BOARD_SIZE - 1 - xy.second) * BOARD_SIZE + xy.first;
}

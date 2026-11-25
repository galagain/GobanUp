#!/bin/sh
set -eu
cd src
em++ -std=c++17 -O3 -msimd128 -fexceptions -D_LIBCPP_ENABLE_CXX17_REMOVED_UNARY_BINARY_FUNCTION -DNDEBUG -DUSE_CPU_ONLY \
  -I. -isystem Eigen -isystem /boost -Wno-deprecated-declarations \
  ../browser/browser.cpp CPUPipe.cpp FastBoard.cpp FastState.cpp FullBoard.cpp GTP.cpp \
  GameState.cpp KoState.cpp NNCache.cpp Network.cpp Random.cpp TimeControl.cpp Timing.cpp \
  UCTNode.cpp UCTNodePointer.cpp UCTNodeRoot.cpp UCTSearch.cpp Utils.cpp Zobrist.cpp \
  -sALLOW_MEMORY_GROWTH -sSTACK_SIZE=8388608 -sMODULARIZE -sEXPORT_NAME=LeelaModule \
  -sENVIRONMENT=worker -sEXPORTED_FUNCTIONS=_load_engine,_choose,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=FS,HEAP32 -o ../browser/engine.js

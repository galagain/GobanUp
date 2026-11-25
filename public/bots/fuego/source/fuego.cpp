#include "SgSystem.h"
#include "SgInit.h"
#include "GoInit.h"
#include "GoUctGlobalSearch.h"
#include "GoUctPlayer.h"
#include "GoUctPlayoutPolicy.h"
#include "SgTimeRecord.h"
using Policy=GoUctPlayoutPolicy<GoUctBoard>;
using Search=GoUctGlobalSearch<Policy,GoUctPlayoutPolicyFactory<GoUctBoard>>;
extern "C" int choose(int n,const int *moves,int ply,double komi){
    static const bool init=[](){SgInit();GoInit();return true;}();
    GoRules rules;
    rules.SetNamedRules("chinese");
    rules.SetKomi(GoKomi(komi));
    GoBoard board(n,GoSetup(),rules);
    for(int i=0;i<ply;++i){
        int m=moves[i];
        const SgMove p=m<0?SG_PASS:SgPointUtil::Pt(m%n+1,m/n+1);
        board.Play(p,i%2?SG_WHITE:SG_BLACK);
    }
    GoUctPlayer<Search,GoUctGlobalSearchState<Policy>> player(board);
    player.SetAutoParam(false);
    player.SetMaxGames(1000);
    player.Search().SetMaxNodes(100000);
    const SgMove move=player.GenMove(SgTimeRecord(true,1.2),SG_WHITE);
    return SgIsSpecialMove(move)?-1:(SgPointUtil::Row(move)-1)*n+SgPointUtil::Col(move)-1;
}

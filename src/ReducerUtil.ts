import {PReduxAction, PReduxActionCreator, PReduxReducer} from './ActionUtil';

export class ReducerUtil {

    static create<State = any>(p: {
        name?: string,
        initState: State,
        debug?: boolean,
        actions: Array<PReduxActionCreator<any, any, State>> |
            { [key: string]: PReduxActionCreator<any, any, State> }
    }) {

        if (!Array.isArray(p.actions)) {
            p.actions = Object.values(p.actions);
        }

        let reducersMap = new Map<string, PReduxReducer<State, any>>();

        p.actions.forEach(value => {
            if (value.reducer) {
                reducersMap.set(value.type, value.reducer)
            }
        });

        const reducer = (state = p.initState, action: PReduxAction<string>) => {
            let reducerFunc = reducersMap.get(action.type);
            if (reducerFunc) {
                return reducerFunc(state, action.payload);
            }
            return state;
        };

        // reducer.name = `${p.name || 'Generated'}-Reducer`;
        reducer.displayName = `${p.name || 'Generated'}-Reducer`;

        return reducer;
    }
}


import produce, {Draft} from 'immer'

export type PReduxAction<Type = any, Payload = any> = { type: Type, payload: Payload };
export type PReduxReducer<State, Payload> = (state: State, payload: Payload) => State
export type PReduxActionCreator<Type, Payload = any, State = any> = ((payload: Payload) => PReduxAction<Type, Payload>) & {
    type: Type,
    reducer?: PReduxReducer<State, Payload>
    displayName?: string
}


export function createActionBuilder<State>() {

    function create<Payload extends {}, Type extends string = any>(
        type: Type, reducer?: PReduxReducer<State, Payload>
    ): PReduxActionCreator<string, Payload> {

        function maker(payload: Payload) {
            return {type, payload}
        }

        maker.displayName = `ActionCreator[${type}]`;
        maker.type = type;
        maker.toString = () => type; // to make possible use action creator in saga as a normal input
        maker.reducer = reducer;
        return maker;
    }

    function immer<Payload extends {}, Type extends string = any>(
        type: Type, reducer: (draft: Draft<State>, payload: Payload) => void
    ): PReduxActionCreator<string, Payload> {


        function maker(payload: Payload) {
            return {type, payload}
        }


        maker.displayName = `ImmerActionCreator[${type}]`;
        maker.type = type;
        maker.toString = () => type; // to make possible use action creator in saga as a normal input
        maker.reducer = (state, payload) => {
            return produce(state, (draft) => reducer(draft, payload));
        };
        return maker;
    }

    // function listApi<Payload extends {}, ItemType = any, Type extends string = any>(
    //     type,
    //     reducer: (state: State, api: PaginationApiStateType<ItemType>, payload: Payload) => State) {
    //     return create(
    //         type,
    //         (state, payload) =>reducer(state,{
    //
    //         })
    //     )
    // }
    //
    // create.listApi = listApi

    create.immer = immer;
    return create // as (typeof create & { listApi: typeof listApi })
}

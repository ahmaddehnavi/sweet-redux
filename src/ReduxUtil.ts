import {createActionBuilder, PReduxActionCreator} from './ActionUtil';
import {createSelector, Selector} from 'reselect';
import {Reducer} from 'redux';
import {ReducerUtil} from './ReducerUtil';
import Application from '../../configs/Application';
import {Draft} from 'immer';

// type ValuesOf<T extends any[]> = T[number];
// type InitStateOf<T extends Array<{ namespace, initState }>> = {
//     [key in T[number]['namespace']]: T[number]['initState']
// };

type ParametricSelector<S, P, R> = (state: S, props?: P, ...args: any[]) => R;
type PSelectorType<State, Return, Param> = Selector<State, Return> | ParametricSelector<State, Param, Return>

type Input<State,
    Namespace extends string,
    Types,
    ActionCreatorMap extends { [key: string]: PReduxActionCreator<any, any, any> },
    SelectorsMap extends { [key: string]: PSelectorType<any, any, any> },
    RootState = { [namespace in Namespace]: State } | any> = {
    /**
     * redux state sub tree name
     * rootState :{
     *     namespace : state
     * }
     * use in combineReducer as a key
     */
    namespace: Namespace
    /**
     * init redux store state
     */
    initState: State,
    /**
     * just use for type checking
     */
    types?: Types,
    debug?: boolean,

    actions: (
        create: (<Payload extends {}, Type extends string = any>(
            type: Type,
            reducer?: (state: State, payload?: Payload) => State
        ) => PReduxActionCreator<Type, Payload>) & {
            /**
             * can mutate draft as a normal js and keep state immutable
             * @param type
             * @param reducer
             * @see https://immerjs.github.io/immer/docs/introduction for more information
             */
            immer: <Payload extends {}, Type extends string = any> (
                type: Type,
                reducer: (draft: Draft<State>, payload?: Payload) => void
            ) => PReduxActionCreator<Type, Payload>
        }
    ) => ActionCreatorMap,

    selectors: (
        create: <R>(selector: Selector<State, R>) => PSelectorType<RootState, R, any>)
        => SelectorsMap
}

type PGeneratedReduxType<NameSpace extends string = string, State = any, ReducerType = any> = {
    namespace: NameSpace,
    initState: State,
    actions,
    selectors,
    reducer: ReducerType,
}


// type IgnoreStateType<Fn extends Function> = Fn extends (state, ...props: infer A) => any ? (state, ...p: A) => any : (state) => any
//
// type X<S, R, P, T extends { [key: string]: PSelector<S, R, P> }> = {
//     [K in keyof T]?: IgnoreStateType<any, any, any, T[K]>;
// };


const actionBuilder = createActionBuilder();
export default class ReduxUtil {
    static debug: boolean = false;

    static create<State,
        Namespace extends string,
        Types extends { [key: string]: string },
        ActionCreatorMap extends ({ [key: string]: PReduxActionCreator<keyof Types, any, State> }),
        SelectorsMap extends { [key: string]: PSelectorType<any, any, any> }>
    (p: Input<State, Namespace, Types, ActionCreatorMap, SelectorsMap>) {

        p.debug = p.debug || this.debug; // || __DEV__ || Application.IS_DEBUG;

        let actionCreatorMap = p.actions(actionBuilder as any);

        let actions: any = {};
        Object.keys(actionCreatorMap).forEach(actionCreatorName => {
            let creator = actionCreatorMap[actionCreatorName];
            let type = creator.type;
            let displayName = p.namespace + '.actions.' + actionCreatorName;

            creator.displayName = displayName;
            /**
             * check for some commonly bugs
             * prevent use same action type more than ones
             * and force to have prefix in all actions
             */
            if (p.debug || __DEV__ || Application.IS_DEBUG) {
                if (!type) {
                    console.error(`invalid action type (${String(type)}) , check ${creator.displayName}`)
                }
                if (!String(type).startsWith(p.namespace)) {
                    console.error(
                        `invalid action type (${type})\n\n` +
                        `all actions type should be started with namespace ("${p.namespace}" in current error)\n\n` +
                        `valid example :\n "${p.namespace}/${type}"\n\n` +
                        `check:\n ${creator.displayName}`
                    )
                }
                if (actions[type]) {
                    console.error(
                        'You try to use a same action type more than ones\n\n' +
                        'because this may cause a bug you should fix it now.\n\n' +
                        `check below :\n\n` +
                        `type : ${type}\n\n` +
                        `first action maker : ${creator.displayName}\n\n` +
                        `second action maker ${actions[type].displayName}\n\n` +
                        `then fix it. :)`)
                }
                actions[type] = creator
            }
        });

        let reducer = ReducerUtil.create({
            name: p.namespace,
            initState: p.initState,
            actions: actionCreatorMap,
            debug: p.debug
        });

        function select(root: any) {
            if (!root) {
                console.error(
                    '\n\nReduxUtil:\n\nroot state is not valid (' + root + ')\n\n' +
                    'you may forget to pass root state to a selector call\n\n' +
                    `for example a valid call should be like this:\n` +
                    `\t"${p.namespace}.selectors.someSelector(state)"\n\n` +
                    `check "${p.namespace}.selectors" to find invalid usage.`
                );
                return
            }
            let state = root[p.namespace];
            if (!state) {
                console.error(
                    '\n\nReduxUtil:\n\nstate is not valid (' + state + ')\n\n' +
                    `maybe forget to add init state to root init state \n\n` +
                    `check ReduxUtil.extractInitState usage and make sure include generated redux with namespace "${p.namespace}"\n\n` +
                    `check src/redux/index.ts`
                );
                return
            }
            return state;
        }

        let selectors = {
            select,
            ...p.selectors((selector) => createSelector(select, selector))
        };

        let redux = {
            namespace: p.namespace as Namespace,
            initState: p.initState,
            actions: actionCreatorMap,
            selectors, // : selectors as ({ [key in keyof typeof selectors]: typeof selectors[key] }),
            reducer,
        };
        if (p.debug) {
            // console.log(redux)
        }
        return redux;
    }


    static extractReducers<T extends string>(...reduxInfo: Array<PGeneratedReduxType<T>>): { [key in T]: Reducer<any, any> } {
        let reducers: any = {};
        reduxInfo.forEach(redux => {
            reducers[redux.namespace] = redux.reducer
        });
        return reducers;
    }

    static extractInitState<T extends string>(...reduxInfo: Array<PGeneratedReduxType<T>>): { [key in T]: any } {
        let state: any = {};
        reduxInfo.forEach(redux => {
            if (state[redux.namespace]) {
                console.error(
                    'ReduxUtil.extractInitState() :\n\n' +
                    'You try use same key more than ones\n\n' +
                    `check ${redux.namespace}`
                )
            }
            state[redux.namespace] = redux.initState
        });
        return state;
    }

}


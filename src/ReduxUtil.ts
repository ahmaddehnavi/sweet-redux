import {createActionBuilder, PReduxActionCreator} from './ActionUtil';
import {createSelector, Selector} from 'reselect';
import {Reducer} from 'redux';
import {ReducerUtil} from './ReducerUtil';
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
    /**
     * actions map
     * @param create
     */
    actions: (
        /**
         *  create an action maker
         *  if you don't pass reducer function then redux state will not change
         *
         *  @see create.immer for a more clean way
         *  @see extractReducers
         */
        create: (<Payload extends {}, Type extends string = any>(
            type: Type,
            reducer?: (state: State, payload?: Payload) => State
        ) => PReduxActionCreator<Type, Payload>) & {
            /**
             * can mutate draft as a normal js and keep state immutable
             *
             * @param type
             * @param reducer
             * @see https://immerjs.github.io/immer/docs/introduction for more information
             * @see create
             */
            immer: <Payload extends {}, Type extends string = any> (
                type: Type,
                reducer: (draft: Draft<State>, payload?: Payload) => void
            ) => PReduxActionCreator<Type, Payload>
        }
    ) => ActionCreatorMap,
    /**
     * selectors map
     * @param create
     *
     * @see https://github.com/reduxjs/reselect
     */
    selectors: (
        /**
         * create simple selector on current name space state
         * if you need more complicated selector use createSelector from "reselect" and return it
         *
         * @see https://github.com/reduxjs/reselect
         */
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

function logError(message: string) {
    console.error('\nsweet-redux:\n' + message + '\n')
}


const actionBuilder = createActionBuilder();
export default class ReduxUtil {

    static debug: boolean = true;
    /**
     * create init state, reducers, action makers and selectors
     * @see extractReducers
     * @see extractInitState
     * @param p
     */
    static create<State,
        Namespace extends string,
        Types extends { [key: string]: string },
        ActionCreatorMap extends ({ [key: string]: PReduxActionCreator<keyof Types, any, State> }),
        SelectorsMap extends { [key: string]: PSelectorType<any, any, any> }>
    (p: Input<State, Namespace, Types, ActionCreatorMap, SelectorsMap>) {

        p.debug = p.debug || this.debug;

        let actionCreatorMap = p.actions(actionBuilder as any);

        if (p.debug) {
            console.log(
                `Sweet Redux (${p.namespace}) debug mode is on\n` +
                'you can disable debug mode to improve performance in production build\n' +
                'check "SweetRedux.debug=false" and "SweetRedux.create({ debug:false ,...})"'
            )
        }

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
            if (p.debug) {
                if (!type) {
                    logError(`invalid action type (${String(type)}) , check ${creator.displayName}`)
                }
                if (!String(type).startsWith(p.namespace)) {
                    logError(
                        `invalid action type (${type})\n\n` +
                        `all actions type should be started with namespace ("${p.namespace})"\n\n` +
                        `1. this pattern make help to find source of error and bugs and also prevent you from using same action type more than one time.` +
                        `2. we may want to use this pattern to do some optimization later.\n\n` +
                        `valid example:\n "${p.namespace}/${type}"\n` +
                        `check:\n ${creator.displayName}`
                    )
                }
                if (actions[type]) {
                    logError(
                        '\n\n' +
                        'You try to use a same action type more than ones\n\n' +
                        'because this may cause a bug you should fix it now.\n\n' +
                        `info:\n\n` +
                        `action type : ${type}\n\n` +
                        `first action maker : ${creator.displayName}\n\n` +
                        `second action maker ${actions[type].displayName}\n\n` +
                        `\n\n`
                    )
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
                logError(
                    '\n\n' +
                    'ReduxUtil:\n\n' +
                    'root state is not valid (' + root + ')\n\n' +
                    'you may forget to pass root state to a selector call\n\n' +
                    `for example a valid call should be like this:\n` +
                    `\t"${p.namespace}.selectors.someSelector(state)"\n\n` +
                    `check "${p.namespace}.selectors" to find invalid usage.
                    \n\n`
                );
                return
            }
            let state = root[p.namespace];
            if (!state) {
                logError(
                    '\n\n' +
                    'ReduxUtil:\n\n' +
                    'state is not valid (' + state + ')\n\n' +
                    `maybe forget to add init state to root init state \n\n` +
                    `check ReduxUtil.extractInitState usage and make sure include generated redux with namespace "${p.namespace}"
                    \n\n`
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

        return redux;
    }


    static extractReducers<T extends string>(...reduxInfo: Array<PGeneratedReduxType<T>>): any/* { [key in T]: Reducer<any, any> }*/ {
        let reducers: any = {};
        if (this.debug) {
            reduxInfo.forEach(redux => {
                if (reducers[redux.namespace]) {
                    logError(
                        'ReduxUtil.extractReducers() :\n\n' +
                        'You try use same key more than ones\n\n' +
                        `check ReduxUtil.extractInitState usages and find "${redux.namespace}"`
                    )
                }
                reducers[redux.namespace] = redux.reducer
            });
        } else {
            reduxInfo.forEach(redux => {
                reducers[redux.namespace] = redux.reducer
            });
        }
        return reducers;
    }

    static extractInitState<T extends string>(...reduxInfo: Array<PGeneratedReduxType<T>>): any /*{ [key in T]: any}*/ {
        let state: any = {};
        if (this.debug) {
            reduxInfo.forEach(redux => {
                if (state[redux.namespace]) {
                    logError(
                        'ReduxUtil.extractInitState() :\n\n' +
                        'You try use same key more than ones\n\n' +
                        `check ReduxUtil.extractInitState usages and find "${redux.namespace}"`
                    )
                }
                state[redux.namespace] = redux.initState
            });
        } else {
            reduxInfo.forEach(redux => {
                state[redux.namespace] = redux.initState
            });
        }
        return state;
    }

}


# sweet-redux
# How to install
`yarn add sweet-redux` or  `npm install sweet-redux --save`

# How to use 

1. NumberRedux.ts

```
import SweetRedux from 'sweet-redux'

const NumberRedux= SweetRedux.create({
  namespace:'number',
  initState:{
    value:100
  },
  actions:(create)=>({
      inc:create('number/inc',(state,payload:{})=>({
          ...state,
          value:state.value+1
      })),
      // update state any way you want and return changed value
      dec:create('number/dec',(state,payload:{})=>({
          ...state,
          value:state.value-1
      })),
      // use immer js
      // check immer js documnetation for mor info
      set:create.immer('number/set',(draft,payload:{value:number})=>{
          draft.value = payload.value
      }),
  }),
  selectors:(create)=>({
    selectCurrentValue:create(state=>state.value)
  })
})

export default NumberRedux
```

2. Store.ts
```
import { createStore } from 'redux'
import SweetRedux from 'sweet-redux'
import NumberRedux from './NumberRedux'

let combinedReducers = SweetRedux.extractReducers(
  NumberRedux
)

let initState = SweetRedux.extractInitState(
  NumberRedux
)

const store = createStore(combinedReducers,initState)

export defaulr store;
```

3. Connected Component
```
type StateProps= {
  value:number
}

type ActionProps={
  set:(value:number)=>void
}

class MyComponent extends React.Component<StateProps&ActionProps> {
    render (){
        return (
            <View>
                <Text> value: {this.props.value}</Text>
                <Button title='set 5' onPress={this.handleOnPress}/>
            </View>
        )
    }
    
    private handleOnPress=()=>{
        this.props.set(5)
    }
}
```

4. Connect Hoc
```
export default connect<StateProps,ActionProps>(
  (state)=>({
      value:NumberRedux.selectors.selectCurrentValue(state)
  }),
  (dispatch)=>({
      set:(value)=>dispatch(NumberRedux.actions.set({value}))
  })
)(MyComponent)  
```

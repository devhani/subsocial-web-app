import React, { useCallback, useEffect, useReducer, useContext, useState } from 'react'
import { ApiPromise, WsProvider } from '@polkadot/api'
import jsonrpc from '@polkadot/types/interfaces/jsonrpc'
import { DefinitionRpcExt, RegistryTypes } from '@polkadot/types/types'
import { registryTypes as SubsocialTypes, AnyAccountId } from '@subsocial/types'
import { newLogger, isNum, nonEmptyStr, isEmptyStr, isDef } from '@subsocial/utils'
import { kusamaUrl } from '../../utils/env'
import { TypeRegistry, GenericAccountId } from '@polkadot/types'
import { Registration } from '@polkadot/types/interfaces'
import { Tag, Tooltip, Dropdown, Popover } from 'antd'
import { hexToString } from '@polkadot/util'
import styles from './index.module.scss'
import { InfoSection, InfoPanel } from 'src/components/profiles/address-views/InfoSection'
import { isObject } from 'formik'
import { CheckCircleFilled } from '@ant-design/icons'
import { DfBgImg } from 'src/components/utils/DfBgImg'
import Avatar from 'antd/lib/avatar/avatar'

type Members = {
  council: AnyAccountId[],
  validators: AnyAccountId[],
  technicalCommittee: AnyAccountId[]
}

type MembersType = keyof Members

const MembersLabels = {
  council: 'Council member',
  validators: 'Validator',
  technicalCommittee: 'Technical committee'
}

type KusamaInfo = {
  display: string,
  legal: string,
  web: string,
  riot: string,
  email: string,
  twitter: string
}

type KusamaInfoKeys = keyof KusamaInfo

const identityInfoKeys: KusamaInfoKeys[] = [ 'display', 'legal', 'web', 'riot', 'email', 'twitter' ]

const log = newLogger('KusamaContext')

type ActionType =
  'RESET_SOCKET' |
  'CONNECT' |
  'CONNECT_SUCCESS' |
  'CONNECT_ERROR'

type Action = {
  type: ActionType
  payload?: any
}

type ApiState = 'CONNECTING' | 'READY' | 'ERROR'

type JsonRpc = Record<string, Record<string, DefinitionRpcExt>>

export type State = {
  endpoint?: string | string[]
  types?: RegistryTypes
  rpc: JsonRpc
  api?: ApiPromise
  registry?: TypeRegistry,
  apiError?: any
  apiState?: ApiState,
  whoIAm: (address: AnyAccountId) => string[],
  isEqualKusamaAddress: (a: AnyAccountId, b: AnyAccountId) => boolean,
  getIdentity: (address: AnyAccountId) => Promise<Registration | undefined>
}

const INIT_STATE: State = {
  endpoint: kusamaUrl,
  types: SubsocialTypes,
  rpc: { ...jsonrpc },
  whoIAm: {} as any,
  isEqualKusamaAddress: {} as any,
  getIdentity: {} as any
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'RESET_SOCKET': {
      const endpoint = action.payload || state.endpoint
      return { ...state, endpoint, api: undefined, apiState: undefined }
    }
    case 'CONNECT': {
      log.info(`Connected to Kusama node ${state.endpoint?.toString()}`)
      return { ...state, api: action.payload, apiState: 'CONNECTING' }
    }
    case 'CONNECT_SUCCESS': {
      if (state.apiState !== 'CONNECTING') {
        const { payload } = action
        let tookTimeLog: string | undefined
        if (isNum(payload)) {
          const startTime = payload
          const tookTime = window.performance.now() - startTime
          tookTimeLog = `Took ${tookTime / 1000} seconds`
        }
        log.info(`✅ Kusama API is ready. ${tookTimeLog}`)
      }
      return { ...state, apiState: 'READY' }
    }
    case 'CONNECT_ERROR': {
      const err = action.payload
      log.error(`❌ Failed to connect to Kusama node ${state.endpoint?.toString()} . ${err}`)
      return { ...state, apiState: 'ERROR', apiError: err }
    }
    default: {
      throw new Error(`Unknown type of action: ${action.type}`)
    }
  }
}

export type Dispatch = (action: Action) => void

type ContextValue = [ State, Dispatch ]

export const KusamaContext = React.createContext<ContextValue>(
  undefined as unknown as ContextValue)

type KusamaProviderProps = React.PropsWithChildren<{
  endpoint?: string
  types?: RegistryTypes
}>

let _api: ApiPromise

export { _api as api }

export const KusamaProvider = (props: KusamaProviderProps) => {
  const initState: State = {
    ...INIT_STATE,
    endpoint: props.endpoint || INIT_STATE.endpoint,
    types: props.types || INIT_STATE.types
  }

  const [ state, dispatch ] = useReducer(reducer, initState)
  const [ members, setMembers ] = useState<Members>()
  const [ kusamaRegistry ] = useState<TypeRegistry>(new TypeRegistry())
  const { api, endpoint, rpc, types, apiState } = state

  const getKusamaAccount = (address: AnyAccountId) => new GenericAccountId(kusamaRegistry, address)

  const whoIAm = (address: AnyAccountId) => {
    if (!members) return []

    const account = getKusamaAccount(address)

    const list: string[] = []

    for (const k in members) {
      const key = k as MembersType
      members[key].includes(account) && list.push(MembersLabels[key])
    }

    return list
  }

  const isEqualKusamaAddress = (a: AnyAccountId, b: AnyAccountId) => {
    const accountA = getKusamaAccount(a)
    const accountB = getKusamaAccount(b)

    return accountA.eq(accountB)
  }

  const getIdentity = async (address: AnyAccountId) => {
    if (!api) return undefined

    const account = getKusamaAccount(address)

    const identity = await api.query.identity.identityOf(account)

    return identity && identity.unwrapOr(undefined)
  }

  // `useCallback` so that returning memoized function and not created
  //   everytime, and thus re-render.
  const connect = useCallback(async () => {
    if (api) return

    log.info(`Connecting to Kusama node ${endpoint} ...`)
    const connectTime = window.performance.now()

    const provider = new WsProvider(endpoint)

    // console.log(`>>> METADATA key: ${Object.keys(metadata || {})}`)

    _api = new ApiPromise({ provider, types, rpc })

    const onConnectSuccess = async () => {

      dispatch({ type: 'CONNECT_SUCCESS', payload: connectTime })
    }

    const onReady = () => {
      dispatch({ type: 'CONNECT', payload: _api })
      onConnectSuccess()
    }

    const onConnect = () => {
      dispatch({ type: 'CONNECT', payload: _api })
      // `ready` event is not emitted upon reconnection. So we check explicitly here.
      _api.isReady.then((_api) => onConnectSuccess())
    }

    _api.on('connected', onConnect)
    _api.on('ready', onReady)
    _api.on('error', err => dispatch({ type: 'CONNECT_ERROR', payload: err }))
    _api.on('disconnected', () => log.info(`Disconnected from Kusama node ${endpoint}`))

    return () => _api?.disconnect()
  }, [ api, endpoint, rpc, types, dispatch ])

  useEffect(() => {
    connect()
  }, [ connect ])

  useEffect(() => {
    if (!api) return

    const loadMembers = async () => {
      const readyApi = await api.isReady
      const council = await readyApi.query.council.members()
      const technicalCommittee = await readyApi.query.technicalCommittee.members()
      const validators = await readyApi.query.session.validators()

      const properties = await readyApi.rpc.system.properties()

      kusamaRegistry.setChainProperties(properties)

      setMembers({ council, technicalCommittee, validators })
    }

    loadMembers()

  }, [ apiState || '' ])

  return (
    <KusamaContext.Provider value={[ { ...state, whoIAm, isEqualKusamaAddress, getIdentity }, dispatch ]}>
      {props.children}
    </KusamaContext.Provider>
  )
}

export const useKusamaContext = () => useContext(KusamaContext)[0]

type KusamaBareProps = {
  address: AnyAccountId
}

export const KusamaIdentityTooltip = ({ address }: KusamaBareProps) => <Tooltip
    placement="topRight"
    color='#fafafa'
    title={<KusamaIdentity
      address={address}
      title={<span className='d-flex justify-content-between'>
        Verify account
        <KusamaVerify address={address} />
      </span>}
      layout='horizontal'
      column={1}
    />}
  >
    <span>
      <DfBgImg src='kusama-logo.svg' size={20} style={{ marginLeft: '.5rem' }} rounded/>
    </span>
  </Tooltip>


export const KusamaRolesTags = ({ address }: KusamaBareProps) => {
  const { whoIAm } = useKusamaContext()

  const roles = whoIAm(address)

  return <div className='mb-2'>
    {roles.map(role => <Tag key={role} color='black' className='mr-3'>{role}</Tag>)}
  </div>
}

export const KusamaVerify = ({ address }: KusamaBareProps) => {
  const identity = useKusamaIdentity(address)

  return (identity?.isVerifySignIn
      && <CheckCircleFilled size={20} style={{ color: '#4dd18f' }} />)
      || null
}

export const useKusamaIdentity = (address: AnyAccountId) => {
  const { getIdentity, apiState } = useKusamaContext()
  const [ kusamaDetails, setInfo ] = useState<Registration>()

  useEffect(() => {
    getIdentity(address).then(setInfo).catch(log.error)
  }, [ apiState || '' ])

  if (!kusamaDetails) return undefined

  const info: KusamaInfo = {} as KusamaInfo;

  identityInfoKeys.forEach(key => { info[key] = hexToString(kusamaDetails.info[key].asRaw.toString()) })
  const isVerifySignIn = !!kusamaDetails.judgements.filter(x => x[1].isReasonable).length
  return {
    info,
    isVerifySignIn
  };
}

const getKusamaItem = (key: KusamaInfoKeys, value: string) => {
  if (isEmptyStr(value)) return undefined

  switch(key) {
    case 'email': return <a href={`mailto:${value}`}>{value}</a>
    case 'twitter': return <a href={`https://twitter.com/${value.replace('@', '')}`}>{value}</a>
    case 'web': return <a href={value}>{value}</a>
    case 'riot': return <a href={value}>{value}</a>
    default: return value
  }
}

type KusamaIdentityProps = KusamaBareProps & {
  title?: React.ReactNode,
  size?: 'middle' | 'small' | 'default',
  column?: number,
  layout?: 'vertical' | 'horizontal',
  withTitle?: boolean,
  withSection?: boolean
}

export const KusamaIdentity = ({ address, title = 'Kusama identity',  withSection, withTitle = true, ...props }: KusamaIdentityProps) => {
  const details = useKusamaIdentity(address)

  if (!details) return null

  const { info } = details

  const items = identityInfoKeys.map(key => ({
    label: key.replace(/(?:^\s*|\s+)(\S?)/g, (b) => b.toUpperCase()),
    value: getKusamaItem(key, info[key])
  })).filter(x => isDef(x.value))

  const infoProps = {
    ...props,
    title: withTitle ? title : undefined,
    level: 3,
    items,
    className: styles.KusamaIdentitySection
  }

  return withSection ? <InfoSection {...infoProps} /> : <InfoPanel {...infoProps} />
}

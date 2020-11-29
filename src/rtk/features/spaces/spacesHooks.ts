import { EntityId } from '@reduxjs/toolkit'
import { shallowEqual } from 'react-redux'
import useSubsocialEffect from 'src/components/api/useSubsocialEffect'
import { useAppDispatch, useAppSelector } from 'src/rtk/app/store'
import { fetchSpaces, selectSpaces } from 'src/rtk/features/spaces/spacesSlice'

export const useFetchSpaces = (ids: EntityId[]) => {
  const dispatch = useAppDispatch()

  const entities = useAppSelector(state => selectSpaces(state, { ids }), shallowEqual)

  useSubsocialEffect(({ subsocial }) => {
    dispatch(fetchSpaces({ api: subsocial, ids }))
  }, [ ids, dispatch ])

  return entities
}
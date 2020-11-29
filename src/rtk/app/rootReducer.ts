import { combineReducers } from '@reduxjs/toolkit'
import contents from '../features/contents/contentsSlice'
import profiles from '../features/profiles/profilesSlice'
import spaces from '../features/spaces/spacesSlice'
import posts from '../features/posts/postsSlice'

const rootReducer = combineReducers({
  contents,
  profiles,
  spaces,
  posts,
})

export type RootState = ReturnType<typeof rootReducer>

export default rootReducer
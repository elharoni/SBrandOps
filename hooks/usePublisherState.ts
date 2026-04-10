// hooks/usePublisherState.ts
import { useReducer, Reducer } from 'react';
import {
    ScheduledPost, SocialPlatform, MediaItem, HashtagSuggestion, PostStatus
} from '../types';

// 1. State Shape
export interface PublisherState {
    post: Omit<ScheduledPost, 'id'>;
    postToEditId: string | null;
    isEditing: boolean;
    activePreviewTab: SocialPlatform | null;
    hashtagSuggestions: HashtagSuggestion[];
    isSuggestingHashtags: boolean;
}

// 2. Initial State
export const initialPublisherState: PublisherState = {
    post: {
        content: '',
        platforms: [],
        platformColors: {},
        media: [],
        status: PostStatus.Draft,
        scheduledAt: null,
        instagramFirstComment: '',
        locations: {},
    },
    postToEditId: null,
    isEditing: false,
    activePreviewTab: null,
    hashtagSuggestions: [],
    isSuggestingHashtags: false,
};

// 3. Action Types
export type PublisherAction =
    | { type: 'SET_POST_FOR_EDITING'; payload: ScheduledPost }
    | { type: 'RESET_STATE' }
    | { type: 'UPDATE_FIELD'; payload: { field: keyof Omit<ScheduledPost, 'id'>; value: any } }
    | { type: 'TOGGLE_PLATFORM'; payload: SocialPlatform }
    | { type: 'ADD_MEDIA'; payload: MediaItem[] }
    | { type: 'REMOVE_MEDIA'; payload: string } // payload is media id
    | { type: 'CLEAR_ALL_MEDIA' }
    | { type: 'UPDATE_MEDIA_ITEM'; payload: MediaItem }
    | { type: 'REORDER_MEDIA'; payload: MediaItem[] }
    | { type: 'SET_ACTIVE_PREVIEW_TAB'; payload: SocialPlatform | null }
    | { type: 'SET_HASHTAGS_LOADING'; payload: boolean }
    | { type: 'SET_HASHTAG_SUGGESTIONS'; payload: HashtagSuggestion[] };

// 4. Reducer Function
const publisherReducer: Reducer<PublisherState, PublisherAction> = (state, action): PublisherState => {
    switch (action.type) {
        case 'SET_POST_FOR_EDITING': {
            const { id, ...postData } = action.payload;
            return {
                ...state,
                post: postData,
                postToEditId: id,
                isEditing: true,
                activePreviewTab: postData.platforms[0] || null,
            };
        }

        case 'RESET_STATE':
            // Revoke URLs before clearing media to prevent memory leaks
            state.post.media.forEach(item => URL.revokeObjectURL(item.url));
            return initialPublisherState;

        case 'UPDATE_FIELD':
            return {
                ...state,
                post: { ...state.post, [action.payload.field]: action.payload.value },
            };

        case 'TOGGLE_PLATFORM': {
            const platform = action.payload;
            const newPlatforms = state.post.platforms.includes(platform)
                ? state.post.platforms.filter(p => p !== platform)
                : [...state.post.platforms, platform];
            
            let newActiveTab = state.activePreviewTab;
            if (newPlatforms.length > 0 && !newPlatforms.includes(newActiveTab!)) {
                newActiveTab = newPlatforms[0];
            } else if (newPlatforms.length === 0) {
                newActiveTab = null;
            }

            return {
                ...state,
                post: { ...state.post, platforms: newPlatforms },
                activePreviewTab: newActiveTab,
            };
        }

        case 'ADD_MEDIA':
            return {
                ...state,
                post: { ...state.post, media: [...state.post.media, ...action.payload] },
            };

        case 'REMOVE_MEDIA': {
            const itemToRemove = state.post.media.find(m => m.id === action.payload);
            if (itemToRemove) URL.revokeObjectURL(itemToRemove.url);
            return {
                ...state,
                post: { ...state.post, media: state.post.media.filter(m => m.id !== action.payload) },
            };
        }
        
        case 'CLEAR_ALL_MEDIA': {
            state.post.media.forEach(item => URL.revokeObjectURL(item.url));
            return {
                ...state,
                post: { ...state.post, media: [] },
            };
        }

        case 'UPDATE_MEDIA_ITEM': {
             const oldMedia = state.post.media.find(m => m.id === action.payload.id);
             if (oldMedia) URL.revokeObjectURL(oldMedia.url);
            return {
                ...state,
                post: {
                    ...state.post,
                    media: state.post.media.map(m => (m.id === action.payload.id ? action.payload : m)),
                },
            };
        }

        case 'REORDER_MEDIA':
            return {
                ...state,
                post: { ...state.post, media: action.payload },
            };
        
        case 'SET_ACTIVE_PREVIEW_TAB':
            return { ...state, activePreviewTab: action.payload };

        case 'SET_HASHTAGS_LOADING':
            return { ...state, isSuggestingHashtags: action.payload };

        case 'SET_HASHTAG_SUGGESTIONS':
            return { ...state, hashtagSuggestions: action.payload };

        default:
            return state;
    }
};

// 5. Custom Hook that exports the reducer logic
export const usePublisherState = () => {
    return useReducer(publisherReducer, initialPublisherState);
};
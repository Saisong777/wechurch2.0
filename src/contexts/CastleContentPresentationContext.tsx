import {createContext,useContext} from 'react';

// Presentation only. This provider belongs to the foreground content window,
// never the persistent castle background or ordinary page branch.
export const CastleContentPresentationContext=createContext(false);
export const useCastleContentPresentation=()=>useContext(CastleContentPresentationContext);

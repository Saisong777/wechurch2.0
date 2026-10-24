import {createContext,useContext} from 'react';
export const CastleWindowContext=createContext(false);
export const useCastleWindowActive=()=>useContext(CastleWindowContext);

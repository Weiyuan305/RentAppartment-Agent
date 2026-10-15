"use client";
import {useEffect,useRef,useState} from "react";
import {MAP_INPUT_KEY,readMapInputMode,type MapInputMode} from "./map-input";

export function useMapInputMode() {
  const [mode,setMode]=useState<MapInputMode>("auto");
  const modeRef=useRef<MapInputMode>("auto");
  useEffect(()=>{
    try {modeRef.current=readMapInputMode(localStorage.getItem(MAP_INPUT_KEY));setMode(modeRef.current);} catch { /* Storage is optional. */ }
  },[]);
  function updateMode(value:MapInputMode) {
    modeRef.current=value;setMode(value);
    try {localStorage.setItem(MAP_INPUT_KEY,value);} catch { /* Keep the in-memory preference. */ }
  }
  return {mode,modeRef,updateMode};
}

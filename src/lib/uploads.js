import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../core/firebase';
import { prepareImageUpload, prepareTrackUpload } from './api';

function runUpload(storagePath, file, onProgress) { const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: file.type }); task.on('state_changed', (snapshot) => onProgress?.(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100))); return { task, promise: new Promise((resolve, reject) => task.on('state_changed', undefined, reject, resolve)) }; }
export async function uploadTrack({ releaseId, title, file, onProgress, onTask }) { const prepared = await prepareTrackUpload({ releaseId, title, size: file.size }); const upload = runUpload(prepared.storagePath, file, onProgress); onTask?.(upload.task); await upload.promise; return prepared; }
export async function uploadImage({ targetType, targetId, file, onProgress, onTask }) { const prepared = await prepareImageUpload({ targetType, targetId, size: file.size, contentType: file.type }); const upload = runUpload(prepared.storagePath, file, onProgress); onTask?.(upload.task); await upload.promise; return prepared; }

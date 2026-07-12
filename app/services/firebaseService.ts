import { collection, getDocs, query, where, orderBy, addDoc, deleteDoc, doc, updateDoc, getDoc, arrayUnion, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth, storage } from '../lib/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LabWork } from '../constants/MockData';
import { Colors } from '../constants/Colors';
// import { Alert } from 'react-native'; // Remove if not used
import { DocumentReference } from 'firebase/firestore';

// Collection references
const experimentsCollection = collection(db, 'Experiments');
const wellPlatesCollection = collection(db, 'WellPlates');
const usersCollection = collection(db, 'users');

// Add types for well plate and well data
type WellData = {
  coordinate: string;
  prediction: string;
};

type WellPlateData = {
  name: string;
  description: string;
  date: Timestamp;
  creator: any;
  experimentId: any;
  effectiveWells: number;
  totalWells: number;
  results: any[];
  imageURL?: string;
};

type ExperimentData = {
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
};

type SharerData = {
  name?: string;
  lastName?: string;
}


// Get experiments for the current user
export const getExperiments = async (): Promise<LabWork[]> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('No user logged in');
      return [];
    }
    
    // Create a reference to the user document
    const userRef = doc(db, 'users', currentUser.uid);
    
    const q = query(
      experimentsCollection,
      where('creator', '==', userRef),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const experiments: LabWork[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Convert Firestore timestamp to ISO string
      const dateString = data.date && data.date.toDate 
        ? data.date.toDate().toISOString() 
        : new Date().toISOString();
      
      experiments.push({
        id: doc.id,
        title: data.title || '',
        subtitle: data.subtitle || '',
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=Experiment',
        date: dateString,
      });
    });
    console.log(experiments)
    return experiments;
  } catch (error) {
    console.error('Error fetching experiments 3:', error);
    return []; // Return empty array on error
  }
};

// Add a new experiment
export const createExperiment = async (experimentData: {
  title: string;
  subtitle?: string;
  description: string;
}): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const userRef = doc(db, 'users', currentUser.uid);

    const newExperiment = {
      title: experimentData.title,
      subtitle: experimentData.subtitle || '',
      description: experimentData.description,
      creator: userRef,
      date: Timestamp.fromDate(new Date()),
      imageUrl: `https://placehold.co/400x300/${Colors.primary.replace('#', '')}/FFFFFF/png?text=${encodeURIComponent(experimentData.title)}`,
      wellPlateIds: [],
    };

    const docRef = await addDoc(experimentsCollection, newExperiment);
    // console.log('Experiment created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating experiment:', error);
    return null;
  }
};

// Delete an experiment
export const deleteExperiment = async (experimentId: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return false;
    }
    
    // Reference to the experiment document
    const experimentRef = doc(db, 'Experiments', experimentId);
    
    // First, delete any entries in sharedWellPlates that reference this experiment
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const q = query(
      sharedWellPlatesCollection,
      where('experimentID', '==', experimentRef)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Delete all matching shared documents
    const deleteSharedPromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteSharedPromises);
    
    // Then delete the experiment document itself
    await deleteDoc(experimentRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting experiment:', error);
    return false;
  }
};

// Share an experiment
export const shareExperiment = async (experimentId: string, userId?: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    const experimentRef = doc(db, 'Experiments', experimentId);
    const sharedExperiment = {
      dateShared: new Date(),
      experimentID: experimentRef,
      sharedBy: doc(db, 'users', currentUser.uid),
      sharedWith: userId ? doc(db, 'users', userId) : null, // Add this field for direct sharing
      isPublic: !userId, // true if shared to hub, false if shared with specific user
    };

    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    await addDoc(sharedWellPlatesCollection, sharedExperiment);

    return true;
  } catch (error) {
    console.error('Error sharing experiment:', error);
    return false;
  }
};

// Check if an experiment is shared
export const isExperimentShared = async (experimentId: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return false;
    }
    
    // Create references
    const userRef = doc(db, 'users', currentUser.uid);
    const experimentRef = doc(db, 'Experiments', experimentId);
    
    // Query sharedWellPlates to see if this experiment is shared
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const q = query(
      sharedWellPlatesCollection,
      where('experimentID', '==', experimentRef),
      where('sharedBy', '==', userRef)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking if experiment is shared:', error);
    return false;
  }
};

// Make an experiment private (remove from shared)
export const makeExperimentPrivate = async (experimentId: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return false;
    }
    
    // Create references
    const userRef = doc(db, 'users', currentUser.uid);
    const experimentRef = doc(db, 'Experiments', experimentId);
    
    // Find all shared entries for this experiment by this user
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const q = query(
      sharedWellPlatesCollection,
      where('experimentID', '==', experimentRef),
      where('sharedBy', '==', userRef)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Delete all matching documents
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return true;
  } catch (error) {
    console.error('Error making experiment private:', error);
    return false;
  }
};

// Get shared experiments for the hub
export const getSharedExperiments = async (): Promise<any[]> => {
  try {
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const q = query(
      sharedWellPlatesCollection,
      where('isPublic', '==', true),
      orderBy('dateShared', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const sharedExperiments = [];
    
    // Process each document
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      
      // Get experiment details
      const experimentRef = data.experimentID;
      const experimentDoc = await getDoc(experimentRef);
      
      if (!experimentDoc.exists()) continue;
      
      const experimentData = experimentDoc.data() as ExperimentData;
      
      // Get sharer details
      const sharerRef = data.sharedBy;
      const sharerDoc = await getDoc(sharerRef);
      
      if (!sharerDoc.exists()) continue;
      
      const sharerData = sharerDoc.data() as SharerData;
      
      // Format date
      const dateShared = data.dateShared?.toDate 
        ? data.dateShared.toDate().toISOString()
        : new Date().toISOString();
      
      sharedExperiments.push({
        id: doc.id,
        experimentId: experimentRef.id,
        experimentTitle: experimentData.title || 'Untitled Experiment',
        experimentSubtitle: experimentData.subtitle || '',
        experimentDescription: experimentData.description || '',
        experimentImageUrl: experimentData.imageUrl || '',
        userFirstName: sharerData.name || '',
        userLastName: sharerData.lastName || '',
        userName: `${sharerData.name || ''} ${sharerData.lastName || ''}`.trim(),
        dateShared: dateShared,
      });
    }
    
    return sharedExperiments;
  } catch (error) {
    console.error('Error fetching shared experiments:', error);
    return [];
  }
};

// Update an experiment
export const updateExperiment = async (
  experimentId: string,
  updates: {
    title?: string;
    subtitle?: string;
    description?: string;
    imageURL?: string;
  }
): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return false;
    }
    
    // Reference to the experiment document
    const experimentRef = doc(db, 'Experiments', experimentId);
    
    // Update the document with only the provided fields
    await updateDoc(experimentRef, updates);
    
    return true;
  } catch (error) {
    console.error('Error updating experiment:', error);
    return false;
  }
};

// Get well plates for an experiment (more efficient temporary solution)
export const getWellPlatesForExperiment = async (experimentId: string): Promise<any[]> => {
  try {
    // Get the experiment document to access wellPlateIds
    const experimentRef = doc(db, 'Experiments', experimentId);
    const experimentDoc = await getDoc(experimentRef);
    
    if (!experimentDoc.exists()) {
      return [];
    }
    
    const experimentData = experimentDoc.data();
    const wellPlateIds = experimentData.wellPlateIds || [];
    
    if (wellPlateIds.length === 0) {
      return [];
    }
    
    // Fetch all well plates in one batch
    const wellPlateRefs = wellPlateIds.map((id: any) => {
      const plateId = typeof id === 'string' ? id : id.id;
      return doc(db, 'WellPlates', plateId);
    });
    
    const wellPlatesData = await Promise.all(wellPlateRefs.map((ref: any) => getDoc(ref)));
    
    // Process the results
    const wellPlates = wellPlatesData
      .filter(doc => doc.exists())
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unnamed Plate',
          description: data.description || '',
          date: data.date?.toDate?.() 
            ? data.date.toDate().toISOString() 
            : new Date().toISOString(),
          status: 'active',
          wells: data.results?.length || 0,
          positiveWells: data.effectiveWells || 0, // Use pre-calculated field if available
          resultsRefs: data.results || [], // Store refs for later processing
        };
      });
    
    // For plates without effectiveWells, fetch in batches
    const platesNeedingCounts = wellPlates.filter(plate => 
      plate.positiveWells === 0 && plate.resultsRefs.length > 0
    );
    
    if (platesNeedingCounts.length > 0) {
      // Process in smaller batches to avoid overwhelming Firestore
      const batchSize = 5;
      for (let i = 0; i < platesNeedingCounts.length; i += batchSize) {
        const batch = platesNeedingCounts.slice(i, i + batchSize);
        await Promise.all(batch.map(async plate => {
          // Get first 10 wells to estimate (for very large plates)
          const sampleSize = Math.min(10, plate.resultsRefs.length);
          const sampleRefs = plate.resultsRefs.slice(0, sampleSize);
          
          let effectiveCount = 0;
          const wells = await Promise.all(sampleRefs.map((ref: any) => getDoc(ref)));
          
          wells.forEach(well => {
            if (well.exists() && well.data().prediction === 'Effective') {
              effectiveCount++;
            }
          });
          
          // Estimate total positive wells based on sample
          if (sampleSize < plate.resultsRefs.length) {
            plate.positiveWells = Math.round(
              (effectiveCount / sampleSize) * plate.resultsRefs.length
            );
          } else {
            plate.positiveWells = effectiveCount;
          }
          
          // Remove the refs as they're no longer needed
          delete plate.resultsRefs;
        }));
      }
    }
    
    // Remove the refs field from all plates
    wellPlates.forEach(plate => {
      delete plate.resultsRefs;
    });
    
    // Sort by date, newest first
    return wellPlates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  } catch (error) {
    console.error('Error fetching well plates for experiment:', error);
    return [];
  }
};

/**
 * Uploads a well plate image to Firebase Storage
 * @param imageUri URI of the image to upload
 * @param wellPlateId ID of the well plate to associate the image with
 * @returns The URL of the uploaded image or null on error
 */
export const uploadWellPlateImage = async (imageUri: string, wellPlateId: string): Promise<string | null> => {
  if (!auth.currentUser) {
    throw new Error('User is not authenticated');
  }

  const userId = auth.currentUser.uid;
  const imageRef = ref(storage, `wellPlates/${userId}/${wellPlateId}/plate.jpg`);

  try {
    console.log(`Starting upload process for well plate image: ${imageUri.substring(0, 50)}...`);
    
    // Handle different URI formats
    let blob: Blob;
    
    if (imageUri.startsWith('data:image')) {
      // Handle base64 data URL
      const base64Data = imageUri.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      // Handle file:// or remote URLs
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      blob = await response.blob();
    }

    // Upload the blob
    await uploadBytes(imageRef, blob);
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
    
  } catch (error) {
    console.error('Error uploading well plate image:', error);
    return null;
  }
};

// Modify the saveWellPlate function to include image upload
export const saveWellPlate = async (
  experimentId: string,
  name: string,
  description: string,
  imageUri: string,
  wellData: WellData[]
): Promise<string | null> => {
  try {
    if (!auth.currentUser) throw new Error('User is not authenticated');
    if (!wellData || wellData.length === 0) throw new Error('No well data provided');

    const effectiveWellsCount = wellData.filter(well => well.prediction === "Effective").length;

    const wellPlateData: WellPlateData = {
      name,
      description,
      date: Timestamp.fromDate(new Date()),
      creator: doc(db, 'users', auth.currentUser.uid),
      experimentId: doc(db, 'Experiments', experimentId),
      effectiveWells: effectiveWellsCount,
      totalWells: 96,
      results: [],
    };

    const wellPlateRef = await addDoc(wellPlatesCollection, wellPlateData);
    const wellPlateId = wellPlateRef.id;

    // Upload image if provided
    if (imageUri) {
      const imageURL = await uploadWellPlateImage(imageUri, wellPlateId);
      if (imageURL) await updateDoc(wellPlateRef, { imageURL });
    }

    // Create wells and store references
    const batch = writeBatch(db);
    const wellsCollection = collection(db, 'Wells');
    const wellRefs: any[] = [];

    wellData.forEach((well) => {
      const row = well.coordinate[0];
      const column = parseInt(well.coordinate.substring(1));
      const wellRef = doc(wellsCollection);
      batch.set(wellRef, {
        row,
        column,
        prediction: well.prediction,
      });
      wellRefs.push(wellRef);
    });

    await batch.commit();

    // Store references as Firestore doc references
    await updateDoc(wellPlateRef, {
      results: wellRefs.map(ref => doc(db, 'Wells', ref.id))
    });

    // Update experiment document to include this well plate reference
    const experimentRef = doc(db, 'Experiments', experimentId);
    const experimentDoc = await getDoc(experimentRef);
    if (experimentDoc.exists()) {
      const experimentData = experimentDoc.data();
      let wellPlateIds = experimentData.wellPlateIds || [];
      if (!Array.isArray(wellPlateIds)) wellPlateIds = [];
      wellPlateIds.push(doc(db, 'WellPlates', wellPlateId));
      await updateDoc(experimentRef, { wellPlateIds });
    }

    // console.log(`Well plate ${wellPlateId} saved with ${wellRefs.length} wells and associated with experiment ${experimentId}`);
    return wellPlateId;
  } catch (error) {
    console.error('Error saving well plate:', error);
    return null;
  }
};

/**
 * Fetches a well plate and its associated wells
 * @param wellPlateId The ID of the well plate to fetch
 * @returns The well plate data with its wells
 */
export const getWellPlateDetails = async (wellPlateId: string) => {
  try {
    // Fetch the well plate document
    const wellPlateRef = doc(db, 'WellPlates', wellPlateId);
    const wellPlateDoc = await getDoc(wellPlateRef);
    
    if (!wellPlateDoc.exists()) {
      throw new Error('Well plate not found');
    }
    
    const data = wellPlateDoc.data();
    const wellPlateData = {
      id: wellPlateDoc.id,
      name: data.name || 'Unnamed Plate',
      description: data.description || '',
      date: data.date?.toDate?.() 
        ? data.date.toDate().toISOString() 
        : new Date().toISOString(),
      imageURL: data.imageURL || null,
      effectiveWells: data.effectiveWells || 0,
      totalWells: data.totalWells || 96,
    };
    
    // Fetch the referenced well documents
    const wellRefs = data.results || [];
    
    if (wellRefs.length === 0) {
      return { ...wellPlateData, wells: [] };
    }
    
    // Fetch all wells in parallel
    const wellDocs = await Promise.all(
  wellRefs.map((wellRef: DocumentReference) => getDoc(wellRef))
);

    
    // Process the well data
    const wells = wellDocs
      .filter(doc => doc.exists())
      .map(doc => {
        const wellData = doc.data();
        const coordinate = `${wellData.row}${wellData.column}`;
        const isEffective = wellData.prediction === "Effective";
        
        return {
          ...wellData,
          coordinate,
          isEffective,
          id: doc.id
        };
      });
    
    // Sort wells by row and column
    wells.sort((a, b) => {
      if (a.row !== b.row) {
        return a.row.charCodeAt(0) - b.row.charCodeAt(0);
      }
      return a.column - b.column;
    });
    
    return { ...wellPlateData, wells };
    
  } catch (error) {
    console.error('Error fetching well plate details:', error);
    throw error;
  }
};

/**
 * Uploads an experiment image to Firebase Storage
 * @param imageUri URI of the image to upload
 * @param experimentId ID of the experiment to associate the image with
 * @returns The URL of the uploaded image or null on error
 */
export const uploadExperimentImage = async (imageUri: string, experimentId: string): Promise<string | null> => {
  if (!auth.currentUser) {
    throw new Error('User is not authenticated');
  }

  const userId = auth.currentUser.uid;
  const imageRef = ref(storage, `experiments/${userId}/${experimentId}/experiment.jpg`);

  try {
    console.log(`Starting upload process for experiment image: ${imageUri.substring(0, 50)}...`);
    
    // Handle different URI formats
    let blob: Blob;
    
    if (imageUri.startsWith('data:image')) {
      // Handle base64 data URL
      const base64Data = imageUri.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      // Handle file:// or remote URLs
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      blob = await response.blob();
    }

    // Upload the blob
    await uploadBytes(imageRef, blob);
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
    
  } catch (error) {
    console.error('Error uploading experiment image:', error);
    return null;
  }
};

// Add this new function to handle well plate deletion
export const deleteWellPlate = async (wellPlateId: string, experimentId: string): Promise<boolean> => {
  try {
    if (!auth.currentUser) throw new Error('User is not authenticated');

    const wellPlateRef = doc(db, 'WellPlates', wellPlateId);
    const experimentRef = doc(db, 'Experiments', experimentId);

    const wellPlateDoc = await getDoc(wellPlateRef);
    if (!wellPlateDoc.exists()) throw new Error('Well plate not found');

    const wellPlateData = wellPlateDoc.data();
    const wellRefs = wellPlateData.results || [];

    const batch = writeBatch(db);

    wellRefs.forEach((wellRef: any) => {
      batch.delete(wellRef);
    });

    batch.delete(wellPlateRef);

    // Update experiment document to remove the well plate reference
    const experimentDoc = await getDoc(experimentRef);
    if (experimentDoc.exists()) {
      const experimentData = experimentDoc.data();
      let wellPlateIds = experimentData.wellPlateIds || [];
      if (!Array.isArray(wellPlateIds)) wellPlateIds = [];
      wellPlateIds = wellPlateIds.filter((ref: any) => {
        if (typeof ref === 'string') return ref !== wellPlateId;
        if (ref.id) return ref.id !== wellPlateId;
        return true;
      });
      batch.update(experimentRef, { wellPlateIds });
    }

    await batch.commit();

    // console.log(`Successfully deleted well plate ${wellPlateId} and its references`);
    return true;
  } catch (error) {
    console.error('Error deleting well plate:', error);
    return false;
  }
};

// Add this new function to handle profile picture uploads
export const uploadProfilePicture = async (imageUri: string): Promise<string | null> => {
  if (!auth.currentUser) {
    throw new Error('User is not authenticated');
  }

  const userId = auth.currentUser.uid;
  const imageRef = ref(storage, `profilePictures/${userId}/profile.jpg`);

  try {
    console.log(`Starting upload process for profile picture: ${imageUri.substring(0, 50)}...`);
    
    // Handle different URI formats
    let blob: Blob;
    
    if (imageUri.startsWith('data:image')) {
      // Handle base64 data URL
      const base64Data = imageUri.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      // Handle file:// or remote URLs
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      blob = await response.blob();
    }

    // Upload the blob
    await uploadBytes(imageRef, blob);
    
    // Get and return the download URL
    const downloadURL = await getDownloadURL(imageRef);
    
    // Update the user document with the new profile picture URL
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profilePictureUrl: downloadURL
    });

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return null;
  }
};

export const getUserByEmail = async (email: string): Promise<any | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    return {
      id: userDoc.id,
      ...userDoc.data(),
    };
  } catch (error) {
    console.error('Error searching for user:', error);
    return null;
  }
};

// Add this new function to get experiments shared directly with the user
export const getExperimentsSharedWithMe = async (): Promise<any[]> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    // Create a reference to the current user
    const userRef = doc(db, 'users', currentUser.uid);
    
    // Query sharedWellPlates where sharedWith matches current user
    const sharedWellPlatesCollection = collection(db, 'sharedWellPlates');
    const q = query(
      sharedWellPlatesCollection,
      where('sharedWith', '==', userRef),
      orderBy('dateShared', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const sharedExperiments = [];

    // Process each document
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      
      // Get experiment details
      const experimentRef = data.experimentID;
      const experimentDoc = await getDoc(experimentRef);
      
      if (!experimentDoc.exists()) continue;
      
      const experimentData = experimentDoc.data() as ExperimentData;
      
      // Get sharer details
      const sharerRef = data.sharedBy;
      const sharerDoc = await getDoc(sharerRef);
      
      if (!sharerDoc.exists()) continue;
      
      const sharerData = sharerDoc.data() as SharerData;
      
      // Format date
      const dateShared = data.dateShared?.toDate 
        ? data.dateShared.toDate().toISOString()
        : new Date().toISOString();
      
      sharedExperiments.push({
        id: doc.id,
        experimentId: experimentRef.id,
        experimentTitle: experimentData.title || 'Untitled Experiment',
        experimentSubtitle: experimentData.subtitle || '',
        experimentDescription: experimentData.description || '',
        experimentImageUrl: experimentData.imageUrl || '',
        userFirstName: sharerData.name || '',
        userLastName: sharerData.lastName || '',
        userName: `${sharerData.name || ''} ${sharerData.lastName || ''}`.trim(),
        dateShared: dateShared,
      });
    }
    
    return sharedExperiments;
  } catch (error) {
    console.error('Error fetching experiments shared with me:', error);
    return [];
  }
};

import { onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Now it's safe to call getExperiments
    getExperiments().then((experiments) => {
      console.log('Fetched experiments:', experiments);
    });
  } else {
    console.log('No user');
  }
});


import { getExperiments } from '../services/firebaseService';

export interface LabWork {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  date: string;
}

export interface Experiment {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  date: string;
}

export interface WellPlate {
  id: string;
  experimentId: string;
  name: string;
  status: string;
  date: string;
  wells: number;
  positiveWells: number;
  description: string;
}

// Original mock data as fallback
export const mockLabWork: LabWork[] = [
  {
    id: '1',
    title: 'Phage DNA Extraction',
    subtitle: 'Protocol #A127',
    description: 'Successful isolation of bacteriophage DNA using modified alkaline lysis method.',
    imageUrl: 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=DNA+Extraction',
    date: new Date('2024-03-15').toISOString(),
  },
  {
    id: '2',
    title: 'Bacterial Culture Growth',
    subtitle: 'Strain E.coli K12',
    description: 'Observed optimal growth rate at 37°C with modified LB medium.',
    imageUrl: 'https://placehold.co/400x300/A8CD89/FFFFFF/png?text=Bacterial+Culture',
    date: new Date('2024-03-14').toISOString(),
  },
  {
    id: '3',
    title: 'Plaque Assay Analysis',
    subtitle: 'Sample Set B23',
    description: 'Identified clear plaques indicating lytic phage activity.',
    imageUrl: 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=Plaque+Assay',
    date: new Date('2024-03-13').toISOString(),
  },
  {
    id: '4',
    title: 'PCR Amplification',
    subtitle: 'Gene Target X459',
    description: 'Successfully amplified phage capsid genes for further analysis.',
    imageUrl: 'https://placehold.co/400x300/A8CD89/FFFFFF/png?text=PCR',
    date: new Date('2024-03-12').toISOString(),
  },
  {
    id: '5',
    title: 'Electron Microscopy',
    subtitle: 'Phage Morphology',
    description: 'Observed distinctive tail fibers in novel bacteriophage isolate.',
    imageUrl: 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=EM+Image',
    date: new Date('2024-03-11').toISOString(),
  },
  {
    id: '6',
    title: 'Host Range Analysis',
    subtitle: 'Cross-Infection Study',
    description: 'Determined broad host range across three bacterial genera.',
    imageUrl: 'https://placehold.co/400x300/A8CD89/FFFFFF/png?text=Host+Range',
    date: new Date('2024-03-10').toISOString(),
  },
  {
    id: '7',
    title: 'Genome Sequencing',
    subtitle: 'NGS Results',
    description: 'Complete genome sequence obtained with 100x coverage.',
    imageUrl: 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=Sequencing',
    date: new Date('2024-03-09').toISOString(),
  },
  {
    id: '8',
    title: 'Protein Analysis',
    subtitle: 'SDS-PAGE Results',
    description: 'Identified major capsid protein at 42 kDa.',
    imageUrl: 'https://placehold.co/400x300/A8CD89/FFFFFF/png?text=Protein',
    date: new Date('2024-03-08').toISOString(),
  },
  {
    id: '9',
    title: 'Phage Therapy Trial',
    subtitle: 'Treatment Group A',
    description: 'Observed 90% reduction in bacterial load after phage treatment.',
    imageUrl: 'https://placehold.co/400x300/355F2E/FFFFFF/png?text=Therapy',
    date: new Date('2024-03-07').toISOString(),
  },
  {
    id: '10',
    title: 'Environmental Sampling',
    subtitle: 'Location: River Delta',
    description: 'Isolated five novel phage strains from water samples.',
    imageUrl: 'https://placehold.co/400x300/A8CD89/FFFFFF/png?text=Sampling',
    date: new Date('2024-03-06').toISOString(),
  },
];

// Function to get experiments - tries Firebase first, falls back to mock data
export const getLabWork = async (): Promise<LabWork[]> => {
  try {
    const firebaseExperiments = await getExperiments();
    return firebaseExperiments.length > 0 ? firebaseExperiments : mockLabWork;
  } catch (error) {
    console.log('Error fetching experiments, using mock data:', error);
    return mockLabWork;
  }
};


// Mock well plates data with experiment associations
export const mockWellPlates: WellPlate[] = [
  {
    id: 'plate1',
    experimentId: '1',
    name: '1',
    status: 'active',
    date: '2025-02-23',
    wells: 96,
    positiveWells: 45,
    description: 'Initial isolation from Lake Erie samples',
  },
  {
    id: 'plate2',
    experimentId: '1',
    name: '2',
    status: 'active',
    date: '2025-02-24',
    wells: 96,
    positiveWells: 32,
    description: 'Second round with filtered samples',
  },
  {
    id: 'plate3',
    experimentId: '1',
    name: '3',
    status: 'active',
    date: '2025-02-25',
    wells: 96,
    positiveWells: 9,
    description: 'Final round with concentrated samples',
  },
];

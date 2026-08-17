import { api } from '../lib/api';

interface LabMember {
  name: string;
  email: string;
  phone: string;
  programme: string;
  designation: string;
  rollNumber: string;
  tenure: string;
  assignedWork: string;
  skills: string;
  software: string;
}

const labMembersData: LabMember[] = [
  {
    name: 'Akasdeep Mondal',
    email: 'akas22082000@gmail.com',
    phone: '8617395440',
    programme: 'EAN',
    designation: 'Project Technical Support',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Experienced with FDM and resin 3D printing',
    skills: '3D printing, Laser cutting, Electronics assembly, Hardware debugging, Mechanical integration',
    software: 'Fusion360, Kicad, LightBurn, RDWorks, Java, TestNG Selenium',
  },
  {
    name: 'Arijit Bera',
    email: 'arijit.phyh.bera@gmail.com',
    phone: '7384144300',
    programme: 'DBF',
    designation: 'Project Technical Officer',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Molecular Biology, LAMP, RPA, PCR, Rt-PCR, LFA, CRISPR-Cas',
    skills: 'Molecular Biology, LAMP, RPA, PCR, RT-PCR, LFA, CRISPR-Cas, Molecular Cloning, Cell Culture',
    software: 'Snapgene, BioEdit, Origin',
  },
  {
    name: 'Abesh Barman',
    email: 'barmanabesh339@gmail.com',
    phone: '7477454653',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Disease diagnostics and microfluidic system for Point-of-Care',
    skills: '3D Printing (FDM, SLA), 3D Bioprinting, Laser cutting, Lateral Flow Assay',
    software: 'Fusion 360, OnShape, Niyantranam, LightBurn, BioRender',
  },
  {
    name: 'Aditya Shivaji Patwari',
    email: 'patwarias7@gmail.com',
    phone: '9112062801',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Electrokinetic experiments, Energy harvesting, Layer-by-Layer functionalization',
    skills: 'Electrokinetic experiments, Energy harvesting, Surface functionalization, XPS, SEM, KPFM',
    software: 'COMSOL, 3D printing',
  },
  {
    name: 'Devraj Sarkar',
    email: 'devrajsarkar785@gmail.com',
    phone: '8777596149',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Protein and Polymeric nanoparticle synthesis and Antibody targeting',
    skills: 'Protein synthesis, Polymeric nanoparticles, Immunoblotting, Immunoprecipitation, PCR',
    software: 'ImageJ, QuantStudio, Snapgene, BioEdit, Origin',
  },
  {
    name: 'Chitrak Mondal',
    email: 'chitrakmondal800@gmail.com',
    phone: '9330535234',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '22ME91R04',
    tenure: '2022-2026',
    assignedWork: 'Dynamics of Janus particles in fluid interfaces',
    skills: 'Numerical Simulation, Perturbation, Linear Stability Analysis, Soft Lithography',
    software: 'COMSOL, MATLAB, Maple',
  },
  {
    name: 'Subhamoy Chatterjee',
    email: 'subhamoy.chat007@gmail.com',
    phone: '9932507668',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Image and Video Understanding, Computer Vision, AI and ML applications',
    skills: 'Computer Vision, Physics-informed Analytics, AI/ML, Android Development, Image Processing',
    software: 'Python, MATLAB, Android Studio, Java',
  },
  {
    name: 'Aditi Mahajan',
    email: 'mahajanaditi1501@gmail.com',
    phone: '9834965054',
    programme: 'MTech (thermal)',
    designation: 'Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Physics-Informed machine learning, Droplet deformation studies, CFD',
    skills: 'Machine Learning, Neural Networks, CFD, Droplet dynamics',
    software: 'Python, TensorFlow, PyTorch, Ansys Fluent, Starccm+, Paraview',
  },
  {
    name: 'Manideep Roy',
    email: 'manideeproymay1999@gmail.com',
    phone: '9609915812',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Numerical simulation, Medical imaging, CAD design, FSI problem',
    skills: 'Numerical simulation, Medical imaging, CAD design, Uncertainty quantification',
    software: 'COMSOL, Simvascular, Ansys Fluent, SolidWorks, MATLAB, Python',
  },
  {
    name: 'Dr. Abhisek Maikap',
    email: 'abhishekmaikap@gmail.com',
    phone: '8001075015',
    programme: 'Post doctoral fellow',
    designation: 'PostDoc Fellow',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Biofluid-interface and bioelectronics, Nano-biosensor devices',
    skills: 'Biosensor fabrication, Electrochemistry, Fluorescence spectroscopy, Thin film coating',
    software: 'XRD, FESEM, XPS, AFM, Origin',
  },
  {
    name: 'Prateekkumar Kotegar',
    email: 'prateekrkotegar@gmail.com',
    phone: '9972818118',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'High-Speed Imaging, Photolithography, Soft lithography',
    skills: 'High-Speed Imaging, Image Processing, Photolithography, Soft lithography, CAD',
    software: 'SolidWorks, Python (OpenCV), ImageJ',
  },
  {
    name: 'Aditya Chattopadhyay',
    email: 'aditya.chattopadhyay02@gmail.com',
    phone: '8420011202',
    programme: 'GME',
    designation: 'Project Associate',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Image Processing, Computer Vision, NLP, Deep Learning, Computational Genomics',
    skills: 'Computer Vision, NLP, Deep Learning, Graph Neural Networks, Reinforcement Learning',
    software: 'Python, PyTorch, TensorFlow, R, C++, Qiskit',
  },
  {
    name: 'Soham Biswas',
    email: 'sohambiswas458@gmail.com',
    phone: '7003396341',
    programme: 'PhD (Dept of Mechanical engg)',
    designation: 'PhD student',
    rollNumber: '25ME92R04',
    tenure: '2026-present',
    assignedWork: 'Biomicrofluidics (Organ-on-chip)',
    skills: 'Soft lithography, High-speed imaging, 3D printing, Cell culture, CFD simulations',
    software: 'Ansys Fluent, COMSOL, SolidWorks',
  },
  {
    name: 'Gourav Sarkar',
    email: 'sarkargourav179@gmail.com',
    phone: '7001682025',
    programme: 'M.Tech(Thermal & Fluids)',
    designation: 'MTech Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Computational Study for Lateral Flow Assay Diagnostics',
    skills: 'Computational modeling, CFD, CAD',
    software: 'COMSOL, ANSYS Fluent, Python, CAD',
  },
  {
    name: 'Sourav Dutta',
    email: 'souravdutta394@gmail.com',
    phone: '9830238612',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Analytical and numerical modelling of FSI using LBM and IBM',
    skills: 'Numerical modeling, FSI, LBM, IBM',
    software: 'Python, MATLAB, COMSOL, Ansys',
  },
  {
    name: 'Kunal Kumar',
    email: 'kunal.kumar.0248@gmail.com',
    phone: '9123271847',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '22ME91R06',
    tenure: '2022-2027',
    assignedWork: 'Flow through soft and swelling channels and porous media',
    skills: 'Porous media, Paper microfluidics, FSI, Swelling, Viscous fingering',
    software: 'COMSOL, OpenPNM, PoreSPY, Avizo, ImageJ',
  },
  {
    name: 'Debmalya Roy',
    email: 'roydebmalya98@gmail.com',
    phone: '9475259281',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Numerical simulations, Nanoscale ion transport, Nanopore fabrication',
    skills: 'Numerical simulations, PNP-NS models, MD simulations, Nanopore fabrication',
    software: 'COMSOL, MATLAB, GROMACS, LabVIEW',
  },
  {
    name: 'Shyamal Manna',
    email: 'shyamal2017manna@gmail.com',
    phone: '9875386972',
    programme: '',
    designation: 'Field Assistant',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Pathological Sample handling and Testing, Data collection',
    skills: 'Sample handling, Lab testing, Data collection',
    software: 'Cell counter, Biochemistry Analyzer, ELISA',
  },
  {
    name: 'Himopravo Chowdhury',
    email: 'himopravo9@gmail.com',
    phone: '9475974209',
    programme: 'MS ( Mechanical Engineering )',
    designation: 'MS Student',
    rollNumber: '',
    tenure: '',
    assignedWork: '3D printing, COMSOL simulation, 3D Modelling, Arduino',
    skills: '3D printing, Simulation, 3D Modelling, Arduino',
    software: 'COMSOL, SolidWorks, MATLAB, ImageJ',
  },
  {
    name: 'Sayantan Dawn',
    email: 'sayantandawn@gmail.com',
    phone: '8777412713',
    programme: 'PhD',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Analytical and Numerical Modelling of FSI, Electrokinetic experiments',
    skills: 'Numerical modeling, FSI, Electrokinetic experiments, Microfabrication, Cell culture',
    software: 'COMSOL, Ansys, MATLAB, AutoCAD, OpenAcc, CUDA',
  },
  {
    name: 'Sayan Kundu',
    email: 'sayankundu721507@gmail.com',
    phone: '9382439584',
    programme: 'PhD',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: '3D Printing, 3D Bioprinting, Paper-based microfluidics',
    skills: '3D Printing, 3D Bioprinting, Biomaterials, Paper microfluidics',
    software: 'SolidWorks, Fusion 360, Ultimaker Cura, Inkscape',
  },
  {
    name: 'Dr. Joyati Das',
    email: 'joyatid5@gmail.com',
    phone: '9831705626',
    programme: 'ICMR DHR Women Scientist',
    designation: 'PDF',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Electrochemical sensor and biosensor development',
    skills: 'Electrochemical sensors, Biosensor fabrication, DPV, CV, EIS',
    software: 'PalmSens, Metrohm Autolab',
  },
  {
    name: 'Sakshi Suryawanshi',
    email: 'saksurywnshi@gmail.com',
    phone: '7587110036',
    programme: 'PhD',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Image Processing, AI/ML models, Drug discovery, Molecular dynamics',
    skills: 'Image Processing, AI/ML, Computer Vision, NLP, Drug discovery',
    software: 'Python, PyTorch, TensorFlow, AutoDock, GROMACS',
  },
  {
    name: 'Subham Ghosh',
    email: 'subhamgh30@gmail.com',
    phone: '9091027391',
    programme: 'PhD (Working Professional)',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Microbiology, Molecular Biology, IVD, Medical Device, Regulatory',
    skills: 'Microbiology, Molecular Biology, IVD, Regulatory (CDSCO, ICMR), Project management',
    software: 'RT-PCR, Sanger sequencing, Oxford Nanopore',
  },
  {
    name: 'Subho Samanta',
    email: 'samantasubho22@gmail.com',
    phone: '8145363245',
    programme: 'PhD (Working Professional)',
    designation: 'PhD student',
    rollNumber: '19AT91W02',
    tenure: '2019-Present',
    assignedWork: 'Biomedical Science and Engineering',
    skills: 'Analytical modeling, CFD',
    software: 'Ansys, Converge, MATLAB, Tecplot, Origin',
  },
  {
    name: 'Subradip Debnath',
    email: 'subradipd.nath@gmail.com',
    phone: '6909096326',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Numerical Simulations, MD, 2D material synthesis, Triboelectric Energy Harvesting',
    skills: 'Numerical Simulations, Molecular Dynamics, Linear Stability, Energy Harvesting',
    software: 'COMSOL, GROMACS, MATLAB, ImageJ',
  },
  {
    name: 'Ganesh Sahadeo Meshram',
    email: 'ganeshmeshram.iitkgp@gmail.com',
    phone: '9561145321',
    programme: 'PhD',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'ML/DL Models for Fluid Flow and Droplet Dynamics, PINNs',
    skills: 'Machine Learning, Deep Learning, Computer Vision, PINNs, Web Development',
    software: 'Python, PyTorch, TensorFlow, MATLAB, COMSOL',
  },
  {
    name: 'Manikandan D',
    email: 'manikandan5110@gmail.com',
    phone: '9965054235',
    programme: 'National Post doctroral fellow (NPDF)',
    designation: 'Post doctroral fellow',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Computational Nanotechnology, Nanofluidics, AI/ML, 2D Membranes, CVD',
    skills: 'Computational Nanotechnology, Nanofluidics, AI/ML, DFT, CVD',
    software: 'COMSOL, GROMACS, LAMMPS, Python, MATLAB, Gaussian',
  },
  {
    name: 'Abhirup Chaudhuri',
    email: 'abhirup.chaudhuri21081993@gmail.com',
    phone: '8335992053',
    programme: 'PhD',
    designation: 'PhD Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Molecular dynamics simulation, Electrokinetic energy harvesting',
    skills: 'Molecular dynamics, Energy harvesting',
    software: 'GROMACS, MATLAB, VMD',
  },
  {
    name: 'Anindya Roy',
    email: 'anindya.roy@kgpian.iitkgp.ac.in',
    phone: '6377032987',
    programme: 'HGS',
    designation: 'Senior Project Associate',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Embedded systems, PCB design, Sensor interfacing, Software development',
    skills: 'Embedded systems, PCB design, Data acquisition, Web design',
    software: 'EasyEDA, Arduino, Python, Visual Studio',
  },
  {
    name: 'Soumyadeep Das',
    email: 'soumyadeepdas1996@gmail.com',
    phone: '8250673277',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Numerical simulation using COMSOL, Analytical techniques',
    skills: 'Numerical simulation, Analytical modeling',
    software: 'COMSOL, Python, Mathematica',
  },
  {
    name: 'Camellia Mitra',
    email: 'camellia.mitra321@gmail.com',
    phone: '6291344908',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Cell culture, Soft Lithography, Electrochemical sensor fabrication, 3D Design',
    skills: 'Cell culture, Soft Lithography, Electrochemical sensors, CAD',
    software: 'Ansys, SolidWorks',
  },
  {
    name: 'Smruti Sourav',
    email: 'smrutisourav01@gmail.com',
    phone: '9777639262',
    programme: 'M.Tech Thermal and Fluids',
    designation: 'Student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Numerical simulation, Medical imaging',
    skills: 'Numerical simulation, Medical imaging',
    software: 'Simvascular, 3D Slicer, MATLAB',
  },
  {
    name: 'Utsab Pal',
    email: 'utsabpal30060@gmail.com',
    phone: '8372979215',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'High-Speed Imaging, Numerical simulations, In-house code development',
    skills: 'High-Speed Imaging, Numerical simulations, Blood sample handling',
    software: 'COMSOL, Fortran, MATLAB, ImageJ',
  },
  {
    name: 'Subham Adhikari',
    email: 'a.subham154@gmail.com',
    phone: '9804591545',
    programme: 'PhD',
    designation: 'PhD student',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Nanoparticle Synthesis, Cell culture, PCR, 3D bioprinting, DFT',
    skills: 'Nanoparticle Synthesis, Cell culture, PCR, 3D bioprinting, DFT',
    software: 'Quantum Espresso, Python, Origin, Graphpad Prism',
  },
  {
    name: 'Debayan Chatterjee',
    email: 'debayan.7.dc@gmail.com',
    phone: '9874789233',
    programme: 'PhD',
    designation: 'Institute Fellow',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Nanomaterial Engineering, Surface Functionalization, Nano-Bio Conjugation',
    skills: 'Nanomaterial Engineering, Surface Functionalization, Bio-Conjugation',
    software: 'FESEM, XRD, Fluorescence Spectroscopy, Electrochemistry',
  },
  {
    name: 'Biswadeep Roy',
    email: 'biswadeeproy84@gmail.com',
    phone: '6003759325',
    programme: 'PhD',
    designation: 'PhD',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Biofluid-interface and bioelectronics, Nano-biosensor devices',
    skills: 'Biosensor fabrication, Electrochemistry, Fluorescence spectroscopy',
    software: 'XRD, FESEM, XPS, AFM',
  },
  {
    name: 'Atin Kumar Dolai',
    email: 'atindolai5@gmail.com',
    phone: '7076711543',
    programme: 'PhD',
    designation: 'PhD',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Microchannel fabrication, Droplet generation, Self-propelled emulsions',
    skills: 'Microchannel fabrication, Droplet dynamics, High-speed imaging',
    software: 'Microscopy, Soft lithography',
  },
  {
    name: 'Dr. Sudip Nag',
    email: 'sdpng2010@gmail.com',
    phone: '9547900307',
    programme: 'IOD',
    designation: 'Project Research Scientist',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Point-of-care diagnostics, Molecular diagnostics, TB detection',
    skills: 'Molecular diagnostics, LAMP, RPA, RT-PCR, Sample Handling',
    software: 'RT-PCR, Sanger sequencing, Origin, ImageJ, QuantStudio',
  },
  {
    name: 'Dr. Sathi Roy',
    email: 'sathi.roy83@gmail.com',
    phone: '8697926936',
    programme: 'DBT-BioCARe Women Scientist',
    designation: 'PDF',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Nanomaterial synthesis, Bioassays, Cell Work, Nano-Bio interaction',
    skills: 'Nanomaterial synthesis, Layer-by-Layer assembly, Cell culture, Cytotoxicity',
    software: 'DLS, Fluorescence spectroscopy, CLSM, Flow Cytometry, ImageJ',
  },
  {
    name: 'Biloy Kumar Jana',
    email: 'biloykumarjana@gmail.com',
    phone: '9564161724',
    programme: 'Infrastructure for Sensor Fabrication',
    designation: 'Senior Project Executive',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Overall project administrative works and accounts',
    skills: 'Project administration, Accounts',
    software: '',
  },
  {
    name: 'Malaikannan G',
    email: 'mkannaniitk@gmail.com',
    phone: '7388459997',
    programme: 'PDF',
    designation: 'Post Doctoral Fellow',
    rollNumber: '',
    tenure: '',
    assignedWork: 'Fluid flow simulations, Hypersonic Aerothermodynamics, Rarefied Gas Dynamics',
    skills: 'DSMC, CFD, Hypersonic Aerothermodynamics, Wind tunnel experiments',
    software: 'SPARTA, FIAT, GMAT, Ansys, CATIA, Python, MATLAB',
  },
  {
    name: 'Pawan Dubey',
    email: 'dubeypawankgp@gmail.com',
    phone: '9450937032',
    programme: 'DSW',
    designation: 'PDF',
    rollNumber: '',
    tenure: '',
    assignedWork: '',
    skills: 'CFD, Simulation',
    software: 'Ansys FLUENT, Abaqus, MATLAB, Python, LIGGGHTS',
  },
  {
    name: 'Romio Mandal',
    email: 'romio639416@gmail.com',
    phone: '8116831271',
    programme: 'DSW',
    designation: 'Research Associate',
    rollNumber: '',
    tenure: '',
    assignedWork: '3D concrete printing',
    skills: '3D concrete printing, Rheometry, Microstructural characterization',
    software: 'Concrete rheometer, 3D printer',
  },
  {
    name: 'Sohom Banerjee',
    email: 'sohom.banner@gmail.com',
    phone: '8820051894',
    programme: 'HJS_SC1',
    designation: 'Project Manager',
    rollNumber: 'J20190236',
    tenure: "Jan '27",
    assignedWork: 'Project management for all Projects',
    skills: 'Project management, Software development, POC diagnostic',
    software: '',
  },
  {
    name: 'Anindita Bhattacharya',
    email: 'bhattacharyaanindita40@gmail.com',
    phone: '6291680362',
    programme: 'PhD',
    designation: 'PhD',
    rollNumber: '21AT91R03',
    tenure: 'Aug 2021- Present',
    assignedWork: 'COMSOL simulations, Analytical modelling',
    skills: 'Numerical simulation, Analytical modeling',
    software: 'COMSOL, MATLAB, Python',
  },
];

const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export async function importLabMembers() {
  const results = [];
  console.log('Starting import of', labMembersData.length, 'lab members...');

  for (let i = 0; i < labMembersData.length; i++) {
    const member = labMembersData[i];
    console.log(`\nProcessing ${i + 1}/${labMembersData.length}: ${member.name}`);

    try {
      let joiningDate = new Date();
      if (member.tenure) {
        const yearMatch = member.tenure.match(/\d{4}/);
        if (yearMatch) {
          joiningDate = new Date(yearMatch[0] + '-01-01');
        }
      }

      console.log(`  Creating account for ${member.email}...`);
      const { data: result, error: createError } = await api.post('/api/admin/users/bulk-import-single', {
        email: member.email,
        full_name: member.name,
        phone: member.phone || null,
        roll_number: member.rollNumber || null,
        employee_id: null,
        department: member.programme || null,
        program_designation: member.designation || null,
        supervisor: null,
        user_role: 'user',
        joining_date: joiningDate.toISOString().split('T')[0],
      });

      if (createError) {
        const errMsg = typeof createError === 'string' ? createError : (createError as any).message || 'Unknown error';
        if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
          console.log(`  Email already exists, skipping...`);
          results.push({
            success: false,
            name: member.name,
            email: member.email,
            error: 'Email already exists',
          });
          continue;
        }
        throw new Error(errMsg);
      }

      console.log(`  Successfully created account for ${member.name}`);
      results.push({
        success: true,
        name: member.name,
        email: member.email,
        password: result.password || '',
      });
    } catch (err: any) {
      console.error(`  ❌ Error creating account for ${member.name}:`, err.message);
      results.push({
        success: false,
        name: member.name,
        email: member.email,
        error: err.message || 'Unknown error',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log('\n========================================');
  console.log('Import Complete!');
  console.log(`✅ Successfully created: ${successCount} accounts`);
  console.log(`❌ Failed: ${failCount} accounts`);
  console.log('========================================\n');

  console.log('Credentials (save these securely):');
  console.log('=====================================');
  results
    .filter((r) => r.success)
    .forEach((r) => {
      console.log(`${r.name} (${r.email}): ${r.password}`);
    });

  return results;
}

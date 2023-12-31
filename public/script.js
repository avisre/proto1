const uploadForm = document.getElementById('uploadForm');
const fetchDataButton = document.getElementById('fetchDataButton');
const dataTable = document.getElementById('dataTable');
const loadingFeedback = document.getElementById('loadingFeedback');
const downloadFeedback = document.getElementById('downloadFeedback');
const customerNameSequence = new Map();

uploadForm.addEventListener('submit', handleUpload);
fetchDataButton.addEventListener('click', fetchData);

function handleUpload(event) {
    event.preventDefault();

    loadingFeedback.classList.remove('hidden');
    downloadFeedback.classList.add('hidden');

    const formData = new FormData(uploadForm);
    fetch('/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = response.url;
            loadingFeedback.classList.add('hidden');
            downloadFeedback.classList.remove('hidden');
        } else {
            throw new Error('Failed to upload Excel sheet.');
        }
    })
    .catch(error => {
        console.error('Error uploading Excel sheet:', error);
        loadingFeedback.classList.add('hidden');
    });
}

function fetchData() {
    loadingFeedback.classList.remove('hidden');
    downloadFeedback.classList.add('hidden');

    fetch('/data')
        .then(response => response.json())
        .then(data => {
            renderData(data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        })
        .finally(() => {
            loadingFeedback.classList.add('hidden');
        });
}

function generateProjectIds(rowData, index) {
  const customerNames = rowData.customerName.split(',').map(name => name.trim());
  const iLabIDs = rowData.iLabID.split(',').map(id => id.trim());
  const sequenceNumber = 1000 + index + 1;
  const data = {};

  customerNames.forEach((name, idx) => {
      const lastName = name.split(' ').pop().trim();
      const projectId = `${sequenceNumber}_${rowData.sequencingID}_${lastName}`;
      data[projectId] = {
          iLabID: iLabIDs[idx] || '',
          fullName: name // Store the full customer name along with the iLab ID
      };
  });

  return data;
}

function renderData(data) {
  dataTable.innerHTML = '';

  const headers = ['Project:ID', 'ilabID', 'Status', 'Customer Name', 'Species Name', 'Sequencing ID', 'Kit Type', 'Name','Date', 'Run Folder', 'Run Type', 'Actions'];

  const headerRow = dataTable.insertRow();

  headers.forEach(headerText => {
      const headerCell = document.createElement('th');
      headerCell.textContent = headerText;
      headerRow.appendChild(headerCell);
  });

  data.forEach((rowData, index) => {
      const projectIdsAndNames = generateProjectIds(rowData, index);

      Object.keys(projectIdsAndNames).forEach(projectId => {
          const { iLabID, fullName } = projectIdsAndNames[projectId];

          const dataRow = dataTable.insertRow();
          dataRow.dataset.id = rowData._id;

          const projectIdCell = document.createElement('td');
          projectIdCell.textContent = projectId;
          dataRow.appendChild(projectIdCell);
          
          const iLabIDCell = document.createElement('td');
          iLabIDCell.textContent = iLabID;
          dataRow.appendChild(iLabIDCell);

          const checkboxCell = document.createElement('td');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = rowData.clicked;
          checkbox.addEventListener('change', function() {
              const isChecked = this.checked;
              fetch(`/update/${rowData._id}`, {
                  method: 'PUT',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ clicked: isChecked }),
              })
              .then(response => {
                  if (response.ok) {
                      console.log('Data updated successfully');
                  } else {
                      console.error('Failed to update data');
                  }
              })
              .catch(error => {
                  console.error('Error updating data:', error);
              });
          });
          checkboxCell.appendChild(checkbox);
          dataRow.appendChild(checkboxCell);

          const fullNameCell = document.createElement('td');
          fullNameCell.textContent = fullName; // Use fullName directly from the object
          dataRow.appendChild(fullNameCell);

          const dataCells = [rowData.speciesName, rowData.sequencingID, rowData.kitType, rowData.name, rowData.date, rowData.runFolder, rowData.runType];
          dataCells.forEach(cellText => {
              const dataCell = document.createElement('td');
              dataCell.textContent = cellText;
              dataRow.appendChild(dataCell);
          });

          const deleteCell = document.createElement('td');
          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.classList.add('deleteBtn');
          deleteButton.setAttribute('data-id', rowData._id);
          deleteButton.addEventListener('click', function() {
              const dataId = this.getAttribute('data-id');
              if (confirm('Are you sure you want to delete this record?')) {
                  fetch(`/delete/${dataId}`, {
                      method: 'DELETE',
                  })
                  .then(response => {
                      if (response.ok) {
                          console.log('Data deleted successfully');
                          fetchData();
                      } else {
                          console.error('Failed to delete data');
                      }
                  })
                  .catch(error => {
                      console.error('Error deleting data:', error);
                  });
              }
          });
          deleteCell.appendChild(deleteButton);
          dataRow.appendChild(deleteCell);
      });
  });
}

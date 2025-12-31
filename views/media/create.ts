import Swal from 'sweetalert2'

function fileFormatOnChange() {
      const fileNameInput= <HTMLInputElement>document.getElementById("mediaFileName");
      const fileFormat = <HTMLInputElement>document.getElementById("fileFormat");
      const temp = fileNameInput.value.split(".")[0]
      fileNameInput.value = temp + fileFormat.value
    };




    document.getElementById('addImagingPlatform').addEventListener(
      'click',
      function enterNewImagingPlatform(e) {
        e.preventDefault()
        Swal.fire({
          title: "Add new Imaging Platform",
          text: "Add new Imaging Platform",
          input: 'text',
          showCancelButton: true,
          inputPlaceholder: "Enter it here.",
          preConfirm: (value) => {
            if (value) {
              if ("<%=imagingPlatforms%>".includes(value))
                Swal.showValidationMessage('This Imaging Platform value already exist')
              const select = <HTMLSelectElement>document.getElementById("imagingPlatform")
              var option = document.createElement('option')
              option.text = option.value = value
              select.add(option, 1)
              select.value = option.text
            } else {
              Swal.showValidationMessage('Value is required')
            }
          }
        })
      }
    )

    document.getElementById('addImageEditingTool').addEventListener(
      'click',
      function enterNewImageEditingTool(e) {
        e.preventDefault()
        Swal.fire({
          title: "Add new Imaging Editing Tool",
          text: "Add new Imaging Editing Tool",
          input: 'text',
          showCancelButton: true,
          inputPlaceholder: "Enter it here.",
          preConfirm: (value) => {
            if (value) {
              if ("<%=imageEditingTools%>".includes(value))
                Swal.showValidationMessage('This Image Editing Tool value already exist')
              const select = <HTMLSelectElement>document.getElementById("imageEditingTool")
              var option = document.createElement('option')
              option.text = option.value = value
              select.add(option, 1)
              select.value = option.text
            } else {
              Swal.showValidationMessage('Value is required')
            }
          }
        })
      }
    )
    document.addEventListener("DOMContentLoaded", () => {
      const form = document.getElementById("main-form");
      const fileNameInput = document.getElementById("mediaFileName");
      const fileFormat = document.getElementById("fileFormat");
      const validExtensions = "<%=fileFormats%>".split(",");
      const now = new Date()
      now.setDate(new Date().getDate())
     ( <HTMLInputElement>document.getElementById('imagingDate')).value = now.toISOString().slice(0, 16).split('T')[0]
      fileFormatOnChange()
      // Check for a valid file extension
      function isValidFileName(filename) {
        if (!filename) return false;
        const lower = filename.toLowerCase();
        if (!lower.endsWith(fileFormat.value)) return false
        if (lower.replace(fileFormat.value, "") == "") return false
        return validExtensions.some(ext => lower.endsWith(ext));
      }

      form.addEventListener("submit", async (e) => {

        e.preventDefault();
        const fileName = fileNameInput.value.trim();
        let errorMessages = [];
        if (!isValidFileName(fileName)) {
          errorMessages.push("📁 The media file name must include a valid extension like `.jpg`, `.png`, `.tiff`, etc. AND must the the same as media File Format from selection drop down box.\n\n");
          fileNameInput.style.borderColor = "red";
        } else {
          fileNameInput.style.borderColor = "";
        }
        const catalogIDRegex = /^[A-Z]{6}\d{7}$/;
        if (!catalogIDRegex.test(document.getElementById('catalogID').value)) {
          errorMessages.push("catalogID is not in the correct format. Example of a correct format: ZRCBDP0012345. 6 capital letters and then 7 numbers. \n\n");
          fileNameInput.style.borderColor = "red";
        } else {
          fileNameInput.style.borderColor = "";
        }

        const clusterIDRegex = /^[\d][A-Z]{7}\d{7}$/
        const clusterID = document.getElementById('clusterID').value
        if (!clusterIDRegex.test(clusterID) && clusterID != "") {
          errorMessages.push("clusterID is not in the correct format. Example of a correct format:3PZRCBDP1234567,  1 number, 7 capital letters and then 7 numbers. \n\n ");
          fileNameInput.style.borderColor = "red";
        } else {
          fileNameInput.style.borderColor = "";
        }
        const resolutionRegex = /^\d{1,5}x\d{1,5}$/;
        if (!resolutionRegex.test(document.getElementById('resolution').value.toLowerCase())) {
          errorMessages.push("resolution is not in the correct format. example format: 1440x720 \n\n");
          fileNameInput.style.borderColor = "red";
        } else {
          fileNameInput.style.borderColor = "";
        }
        if (errorMessages.length > 0) {
          e.preventDefault(); // prevent form submission
          Swal.fire({
            icon: 'error',
            title: 'Validation Issue',
            html: errorMessages.join("<br>"),
            confirmButtonColor: '#007bff'
          });
        } else {
          imagingPlatforms = "<%=imagingPlatforms%>"
          imageEditingTools = "<%=imageEditingTools%>"
          const formData = JSON.stringify({
            fileName: form.mediaFileName.value,
            filePath: form.filePath.value,
            catalogID: form.catalogID.value,
            morphoID: form.morphoID.value,
            clusterID: form.clusterID.value,
            imagingDate: form.imagingDate.value,
            resolution: form.resolution.value == "" ? null : form.resolution.value,
            fileSizeBytes: form.fileSizeBytes.value,
            fileFormat: form.fileFormat.value,
            description: form.description.value,
            imagingPlatform: form.imagingPlatform.value == "" ? null : form.imagingPlatform.value,
            imageEditingTool: form.imageEditingTool.value == "" ? null : form.imageEditingTool.value,
            newImagingPlatform: (!imagingPlatforms.includes(form.imagingPlatform.value)) ? form.imagingPlatform.value : null,
            newImageEditingTool: (!imageEditingTools.includes(form.imageEditingTool.value)) ? form.imageEditingTool.value : null,
            comments: form.comments.value,
            projectAndPhotographerPair: form.projectAndPhotographerPair.value,
          })
          console.log(formData)

          const submitBtn = form.querySelector('button[type="submit"]');
          const originalBtnText = submitBtn.innerHTML;
          submitBtn.classList.add('loading');
          submitBtn.innerHTML = '<i class="fas fa-spinner"></i> Submitting...';
          submitBtn.disabled = true;
          const response = await fetch("/media/create", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: formData
          });
          try {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || "Submission failed with status " + response.status);
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error(data.message || "Submission failed");
            }


            // Show success message
            await Swal.fire({
              title: 'Success!',
              text: 'project created successfully!',
              icon: 'success',
              confirmButtonText: 'OK',
              confirmButtonColor: '#28a745',
              timer: 1000,
              timerProgressBar: true
            });

            // Redirect if URL is provided
            if (data.redirectUrl) {
              window.location.href = data.redirectUrl;
              return; // Stop further execution
            }

            // Reset form (if no redirection)
            form.reset();

          } catch (error) {
            await Swal.fire({
              title: 'Error!',
              text: error.message,
              icon: 'error',
              confirmButtonText: 'OK',
              confirmButtonColor: '#dc3545'
            });
          } finally {
            submitBtn.disabled = false;
            submitBtn.value = "Upload"
            submitBtn.innerHTML = "Upload"
          }
        }
      });
    });
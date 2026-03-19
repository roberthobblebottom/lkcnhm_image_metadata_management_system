import sys
import PIL.Image
from PIL.ExifTags import TAGS
from timeit import default_timer as timer
from datetime import timedelta
import polars as pl
from polars import lit, col, when
from os.path import isdir, getsize
from glob import glob
import configparser
import re
from datetime import datetime
import logging
from tkinter import font, ttk
from tkinter import *
from tkinter import filedialog, messagebox
from PIL.ExifTags import TAGS, GPSTAGS, IFD
import platform
logger = logging.getLogger(__name__)
import os
# from PIL import ExifTags
# IFD_CODE_LOOKUP = {i.value: i.name for i in ExifTags.IFD}
now = datetime.now().isoformat().replace(".", "-").replace(":", "-")
logging.basicConfig(filename="pipeline-" + now + ".log", level=logging.INFO)


def recursion(
    path,
    output,
    # photographerID,
    # projectID
    window_pending,
    logger,
    progresStringVar,
    finishedCount,
    totalCount,
    startTimer
):
    _p =path + "\\*" if platform.system() == 'Windows' else path + "/*"
    for file_or_folder_path in glob(_p):
        # if not isRunning:
        # return
        if isdir(file_or_folder_path):
            return recursion(
                file_or_folder_path,
                output,
                # photographerID,
                # projectID
                window_pending,
                logger,
    progresStringVar=progresStringVar,
    finishedCount=finishedCount,
    totalCount=totalCount,
    startTimer=startTimer
            )
        if file_or_folder_path.split(".")[-1] not in [
            "tiff",
            "raw",
            "tif",
            "jpg",
            "jpeg",
            "png",
            "tiff",
            "tif",
            "svg",
        ]:
            logger.info(
                " the file " + file_or_folder_path + " not an valid image extension"
            )
            continue
        if "LABEL" in file_or_folder_path or "THUMB" in file_or_folder_path:
            logger.info("label or thumb file, " + file_or_folder_path + " skipping.")
            continue
        # This line may be the bottleneck in terms of throughput and speed
        exifData = PIL.Image.open(file_or_folder_path).getexif()
        new_row = {}
        # new_row["ProjectName"] = projectID
        photographerID = None
        new_row["PhotographerID"] = photographerID
        new_row["FilePath"] = file_or_folder_path
        splitter = "\\" if platform.system() == 'Windows' else '/'
        new_row["FileName"] = file_or_folder_path.split(splitter)[-1]
        new_row["FileFormat"] = "." + file_or_folder_path.split(".")[-1]
        fileNameArray = new_row["FileName"].split("_")
        new_row["CatalogID"] = fileNameArray[1]
        # if not re.search("^[A-Z]{6}\\d{7,8}$", new_row["CatalogID"]):
        #     raise Exception(
        #         "CatalogID in the file "
        #         + new_row["FileName"]
        #         + " is not in the correct format. Example of a correct format: ZRCBDP0012345. 6 capital letters and then 7 numbers."
        #     )
        new_row["MorphoID"] = fileNameArray[0]
        # if len(new_row["MorphoID"]) < 5 or new_row["MorphoID"] is int:
        #     raise Exception(
        #         "MorphoID in the file "
        #         + new_row["FileName"]
        #         + " may not not in the correct format of a taxon name."
        #     )
        # part_with_fileFormat = fileNameArray[-1].split(".")
        new_row["Description"] = (
            fileNameArray[-2] + "   " + fileNameArray[-1].split(".")[0]
            if fileNameArray[-2].lower() != "none"
            else fileNameArray[-1].split(".")[0]
        )

        new_row["FileSizeBytes"] = getsize(file_or_folder_path)

        f = [
            "DateTime",
            "Software",
            "ImageWidth",
            "ImageLength",
            "Make",
            "Model",
            "Description",
        ]
        for tagid in exifData:
            tagname = TAGS.get(tagid, tagid)

            if tagname in f:
                value = exifData.get(tagid)

                if value == "" or value is None:
                    new_row[tagname] = str(value)
                    continue
                value = value.hex().decode() if isinstance(value, bytes) else value
                value = value.split(" ")[0] if tagname == "DateTime" else value
                # if tagname in ["ImageWidth", "ImageLength"]:
                # try:
                # int(value)
                # except Valu.info:
                #     raise Exception(
                #         "the file"
                #         + new_row["FileName"]
                #         + "has a image width or length value that is not integer. please change it to an integer"
                #     )
                # elif tagname == "DateTime":
                # try:
                #     datetime.strptime(value, "%Y:%m:%d")
                # except Valu.info:
                #     raise Exception(
                #         "the file"
                #         + new_row["FileName"]
                #         + "has a DateTime value that is not in for format of %Y:%m:%d eg: 2005:11:08. please change it."
                #     )
                new_row[tagname] = str(value)

            # if type(value) is bytes:
            #     new_row[str(tagname)] = "BINARY NOT CAPTURED"
            # else:
            #     new_row[str(tagname)] = str(value) if value is not None else ""
        for x1 in f:
            if x1 not in list(new_row.keys()):
                new_row[x1] = ""
        img = PIL.Image.open(file_or_folder_path)
        logger.info(img.size)
        if new_row["ImageWidth"] == "":
            new_row["Resolution"] = str(img.size[0]) + "x" + str(img.size[1])

        for ifd_id in IFD:
            logger.info(">>>>>>>>>" + ifd_id.name + "<<<<<<<<<<")
            try:
                ifd = exifData.get_ifd(ifd_id)
                logger.info(ifd)
                if ifd_id == IFD.GPSInfo:
                    resolve = GPSTAGS
                else:
                    resolve = TAGS

                for k, v in ifd.items():
                    tag = resolve.get(k, k)
                    logger.info("DEEPER INFO:" + str(tag) + str(v))
            except KeyError:
                logger.info("KeyError")
                pass
        # logger.info('new_row '+str(new_row))
        columns_to_select = [
            "MorphoID",
            "CatalogID",
            "FileName",
            "FilePath",
            "FileSizeBytes",
            "FileFormat",
            # "ProjectName",
            "PhotographerID",
            "ImagingDate",
            "ImageEditingTool",
            "Make",
            "Model",
            "Description",
        ]
        if "Resolution" not in new_row.keys():
            columns_to_select.extend(["ImageWidth", "ImageLength"])
        else:
            columns_to_select.extend(["Resolution"])
        new_row = (
            pl.DataFrame(new_row)
            .rename({"Software": "ImageEditingTool"})
            .rename({"DateTime": "ImagingDate"})
            .select(columns_to_select)
        )

        logging.info(str(new_row.transpose(include_header=True)))
        output.append(new_row)
        finishedCount += 1
        progresStringVar.set(progresStringVar.get().split(":")[0]+": "+str(finishedCount)+"/"+str(totalCount) +" \nTime: "+str(timedelta(seconds = timer()-startTimer)))
        window_pending.update()


def main():

    pl.Config.set_tbl_rows(100)
    pl.Config.set_tbl_cols(100)
    start = timer()
    output = []
    font = ("Helvetica", 20)

    # global window_pending
    windowPending = Tk()
    windowPending.geometry("900x300")
    windowPending.title("Set Up Pipeline")

    config = configparser.ConfigParser()
    try:
        config.read("config.ini")
    except Exception:
        x = "Unable reading config.ini, Maybe config.ini is missing from the current directory? Or the required variables 'directory' not present."
        logger.info(x)
        windowPending.destroy()
        w = Toplevel()
        w.geometry("1500x200")
        w.title("Error")
        label = ttk.Label(w, text=x, font=font, wraplength=1500, justify="center")
        exit_button = ttk.Button(w, text="Exit", command=lambda: w.quit(), font=font)
        label.pack()
        exit_button.pack(ipadx=5, ipady=5, expand=True)
        w.mainloop()
        return

    # photographerID = (
    #     config["DEFAULT"]["photographerID"]
    #     if config["DEFAULT"]["photographerID"]
    #     else ""
    # )
    dir = config["DEFAULT"]["directory"] if config["DEFAULT"]["directory"] else ""

    label = ttk.Label(
        windowPending,
        text="Setting up image metadata pipeline,\n Select a folder and press 'Extract'.\n For more information, please consult the documentation.",
        font=font,
        wraplength=0.3,
        justify=CENTER,
    )
    msg = dir if dir != "" else "None selected"
    labelFileOpen = ttk.Label(
        windowPending,
        text="Folder selected: " + msg,
        font=font,
        wraplength=500,
    )
    # labelPhotographerID = ttk.Label(
    #     windowPending, text="Photographer ID:", font=font, wraplength=0.3
    # )
    # photographerIDStringVar = StringVar(value=photographerID)
    # photographerIDEntry = ttk.Entry(
    #     windowPending, textvariable=photographerIDStringVar, font=font
    # )
    dirStringVar = StringVar(value=dir)

    logger.info("dir" + dirStringVar.get())

    def browseFiles():
        filename = filedialog.askdirectory(
            initialdir="/",
            title="Select a folder",
        )
        dirStringVar.set(filename)
        labelFileOpen.configure(text="folder opened: " + filename)

    button_file_select = Button(
        windowPending, text="select folder", command=browseFiles, font=font
    )

    def continue_main():
        dir = dirStringVar.get()
        totalCount = 0
        finishedCount = 0
        splitter = "\\" if platform.system() == 'Windows' else '/'
        # photographerID = photographerIDStringVar.get()
        # if not photographerID.isdigit():
        #     messagebox.showerror("Invalid Input", "must be an integer")
        #     return
        if dir == "":
            messagebox.showerror("Missing folder selection", "folder must be selected")
            return
        # config["DEFAULT"]["photographerID"] = photographerID
        config["DEFAULT"]["directory"] = dir
        with open("config.ini", "w") as c:
            config.write(c)
        windowPending.destroy()
        for x in os.listdir(dir):
            if os.path.isfile(dir+splitter+x):
                totalCount = totalCount + 1
        w = Tk()
        w.geometry("700x150")
        w.title("Running")
        progresStringVar = StringVar(value = "The Extraction is currently running progress: /"+str(totalCount))
        label = ttk.Label(
            w,
            textvariable= progresStringVar,
            font=font,
            wraplength=1500,
            justify="center",
        )
        buttonQuit2 = Button(w, text="quit", command=lambda: exit(), font=font)
        label.grid(column=1, row=1)
        buttonQuit2.grid(column=1, row=2)
        w.update()
        recursion(
            path=dir,
            output=output,
            # photographerID=photographerID,
            # projectID = f3.split("/")[-1]
            window_pending=windowPending,
            logger=logger,
            progresStringVar=progresStringVar,
            finishedCount=finishedCount,
            totalCount=totalCount,
            startTimer = start
        )

        stop = timer()
        totalTimeTaken = str(timedelta(seconds=stop - start))
        logger.info("estimated time taken " + totalTimeTaken)

        df = pl.concat(output)
        df =df.with_columns(
            Resolution=when((col("ImageLength") != "") | (col("ImageWidth") != ""))
            .then(pl.concat_str(col("ImageLength"), lit("x"), col("ImageWidth")))
            .otherwise(lit(""))
        ) if "Resolution" not in df.columns else df
        df = df.with_columns(
            ImagingDate=col("ImagingDate").str.to_datetime(
                "%Y:%m:%d", ambiguous="null", strict=False
            ),
            imagingPlatform=when((col("Make") != "") | (col("Model") != ""))
            .then(pl.concat_str(col("Make"), lit(" "), col("Model")))
            .otherwise(lit("")),
        ).select(pl.exclude("ImageWidth", "ImageLength", "Make", "Model"))

        # fileName = "metadata_for_photographer_ID_" + str(photographerID) + ".csv"
        fileName = "metadata-"+str(now)+".csv"
        df.write_csv(fileName)
        windowPending.quit()
        w.destroy()
        w = Tk()
        w.geometry("1000x400")
        w.title("success!")
        label = ttk.Label(
            w,
            text="The Metatdata is extracted as " + fileName 
            + "\n log file is also saved. Both files are in the same folder."
            + "\n total extraction time:"+totalTimeTaken
            + "\n UPLOAD THE METADATA IMMEDIATELY INTO THE IMAGE METADATA MANAGMENT SYSTEM.",
            font=("Helvetica", 30),
            wraplength=1000,
        )
        label.pack()
        exit_button = Button(w, text="Exit", command=lambda: w.quit(), font=font)
        exit_button.pack(ipadx=5, ipady=5, expand=True)
        w.mainloop()

    buttonStart = Button(
        windowPending, text="Extract", command=continue_main, font=font
    )
    buttonQuit = Button(
        windowPending, text="Quit", command=lambda: windowPending.quit(), font=font
    )
    label.grid(column=1, row=1)
    labelFileOpen.grid(column=1, row=2)
    button_file_select.grid(column=2, row=2)

    # labelPhotographerID.grid(column=1, row=4)
    # photographerIDEntry.grid(column=2, row=4)

    buttonStart.grid(column=1, row=5)
    buttonQuit.grid(column=2, row=5)
    windowPending.mainloop()

if __name__ == "__main__":
    main()

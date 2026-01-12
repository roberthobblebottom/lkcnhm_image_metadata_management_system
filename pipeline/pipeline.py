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

logger = logging.getLogger(__name__)
# from PIL import ExifTags
# IFD_CODE_LOOKUP = {i.value: i.name for i in ExifTags.IFD}


def recursion(
    path,
    output,
    photographerID,
    # projectID
    window_pending,
):
    for file_or_folder_path in glob(path + "/*"):
        if not isRunning:
            return
        if isdir(file_or_folder_path):
            return recursion(
                file_or_folder_path,
                output,
                photographerID,
                # projectID
                window_pending,
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
            logging.info(
                " the file " + file_or_folder_path + " not an valid image extension"
            )
            continue
        if "LABEL" in file_or_folder_path or "THUMB" in file_or_folder_path:
            logging.info("label or thumb file, " + file_or_folder_path + " skipping.")
            continue
        # This line may be the bottleneck in terms of throughput and speed
        exifData = PIL.Image.open(file_or_folder_path).getexif()

        new_row = {}
        # new_row["ProjectName"] = projectID
        new_row["PhotographerID"] = photographerID
        new_row["FilePath"] = file_or_folder_path
        new_row["FileName"] = file_or_folder_path.split("/")[-1]
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
            "DateTime",  # TODO Not sure how to write a validation for this.
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
        new_row = (
            pl.DataFrame(new_row)
            .rename({"Software": "ImageEditingTool"})
            .rename({"DateTime": "ImagingDate"})
            .select(
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
                "ImageWidth",
                "ImageLength",
                "Make",
                "Model",
                "Description",
            )
        )
        logging.info(new_row.transpose(include_header=True))
        output.append(new_row)

        window_pending.update()


def main():
    logging.basicConfig(
        filename="pipeline " + datetime.now().isoformat() + ".log", level=logging.INFO
    )
    pl.Config.set_tbl_rows(100)
    pl.Config.set_tbl_cols(100)
    start = timer()
    output = []
    dir = "./*"
    config = configparser.ConfigParser()
    # global window_pending
    window_pending = Tk()
    window_pending.geometry("1500x200")
    window_pending.title("Running")
    label = ttk.Label(
        window_pending,
        text="Running Image Metadata pipeline",
        font=("Helvetica", 30),
        wraplength=0.3,
    )
    label.pack()
    ttk.Style().configure("my.TButton", font=("Helvetica", 30))
    global isRunning
    isRunning = True

    def close_window_pending():
        global isRunning
        isRunning = False
        window_pending.destroy()
        exit()

    # I don't know how to make a working close button TODO
    window_pending.protocol("WM_DELETE_WINDOW", close_window_pending)
    window_pending.bind("<Escape>", close_window_pending)
    window_pending.update()

    def error(x, window_pending):
        window_pending.quit()
        w = Toplevel()
        w.geometry("1500x200")
        w.title("Error")
        label = ttk.Label(w, text=x, font=("Helvetica", 30), wraplength=0.3)
        label.pack()
        exit_button = ttk.Button(
            w, text="Exit", command=lambda: w.quit(), style="my.TButton"
        )
        exit_button.pack(ipadx=5, ipady=5, expand=True)
        w.mainloop()
        return

    try:
        config.read("config.ini")
    except Exception:
        x = "Unable reading config.ini, Maybe config.ini is missing from the current directory?"
        logger.info(x)
        error(x, window_pending)
        return

    try:
        photographerID = int(config["DEFAULT"]["photographerID"])
    except Exception:
        x = "photographerID is not an integer."
        logger.info(x)
        error(x,window_pending)
        return

    if photographerID <= 0:
        x = "photographerID can only be a positive integer."
        logger.info(x)
        error(x, window_pending)
        return

    for f3 in [x for x in glob(dir) if isdir(x)]:
        recursion(
            path=f3,
            output=output,
            photographerID=photographerID,
            # projectID = f3.split("/")[-1]
            window_pending=window_pending,
        )
        if not isRunning:
            break

    stop = timer()
    logger.info("estimated time taken " + str(timedelta(seconds=stop - start)))

    df = (
        pl.concat(output)
        .with_columns(
            Resolution=when((col("ImageLength") != "") | (col("ImageWidth") != ""))
            .then(pl.concat_str(col("ImageLength"), lit("x"), col("ImageWidth")))
            .otherwise(lit("")),
            ImagingDate=col("ImagingDate").str.to_datetime(
                "%Y:%m:%d", ambiguous="null", strict=False
            ),
            imagingPlatform=when((col("Make") != "") | (col("Model") != ""))
            .then(pl.concat_str(col("Make"), lit(" "), col("Model")))
            .otherwise(lit("")),
        )
        .select(pl.exclude("ImageWidth", "ImageLength", "Make", "Model"))
    )
    fileName = "metadata_for_photographer_ID_" + str(photographerID) + ".csv"
    df.write_csv(fileName)
    window_pending.quit()
    w = Toplevel()
    w.geometry("1600x200")
    w.title("Sucess!")
    label = ttk.Label(
        w,
        text="The Metatdata is extracted as " + fileName,
        font=("Helvetica", 30),
        wraplength=0.3,
    )
    label.pack()
    exit_button = ttk.Button(
        w, text="Exit", command=lambda: w.quit(), style="my.TButton"
    )
    exit_button.pack(ipadx=5, ipady=5, expand=True)
    w.mainloop()


if __name__ == "__main__":
    main()
